import React, { useState, useMemo, useRef } from 'react';
import {
  Share2,
  Tag,
  Download,
  Calendar,
  Lock,
  Eye,
  CheckCircle2,
  AlertCircle,
  FileCheck2,
  Sparkles,
  Upload,
  Cloud,
} from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import { useCloudStore } from '../store/useCloudStore';
import { queryAll, openDatabase, execute, exportDatabase } from '../lib/jw/sqlite';
import { createOrUpdateManifest } from '../lib/jw/manifest';
import { packageJwLibrary } from '../lib/jw/zip';
import { INote, ILocation, ITag, ITagMap } from '../lib/jw/types';
import { useTranslation } from 'react-i18next';

export const SharePage: React.FC = () => {
  const { t } = useTranslation();
  const { activeDb, activeManifest, summary, loadDemoLibrary, isLoading } = useAppStore();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [selectedTagNames, setSelectedTagNames] = useState<string[]>([]);
  const [dateRangeFrom, setDateRangeFrom] = useState<string>('');
  const [dateRangeTo, setDateRangeTo] = useState<string>('');
  const [exportName, setExportName] = useState<string>('Shared Notes');
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [exportComplete, setExportComplete] = useState<boolean>(false);

  // Query all tags
  const availableTags = useMemo(() => {
    if (!activeDb) return [];
    try {
      return queryAll<{ TagId: number; Name: string; count: number }>(
        activeDb,
        `SELECT t.TagId, t.Name, COUNT(tm.TagMapId) AS count 
         FROM Tag t 
         JOIN TagMap tm ON t.TagId = tm.TagId 
         GROUP BY t.TagId, t.Name 
         ORDER BY count DESC`
      );
    } catch (_) {
      return [];
    }
  }, [activeDb, summary]);

  // Query all notes with their tags
  const allNotes = useMemo(() => {
    if (!activeDb) return [];
    try {
      const notes = queryAll<any>(
        activeDb,
        `SELECT n.NoteId, n.Title, n.Content, n.Created, n.LastModified, l.Title as locationTitle
         FROM Note n
         LEFT JOIN Location l ON n.LocationId = l.LocationId`
      );

      const tagMap = new Map<number, string[]>();
      const tagRows = queryAll<{ NoteId: number; Name: string }>(
        activeDb,
        `SELECT tm.NoteId, t.Name FROM TagMap tm JOIN Tag t ON tm.TagId = t.TagId WHERE tm.NoteId IS NOT NULL`
      );
      for (const r of tagRows) {
        const list = tagMap.get(r.NoteId) || [];
        list.push(r.Name);
        tagMap.set(r.NoteId, list);
      }

      return notes.map((n) => ({
        ...n,
        tags: tagMap.get(n.NoteId) || [],
      }));
    } catch (_) {
      return [];
    }
  }, [activeDb, summary]);

  // Notes matching the share filter
  const matchingNotes = useMemo(() => {
    return allNotes.filter((n) => {
      // Tag filter
      if (selectedTagNames.length > 0) {
        const hasTag = n.tags.some((t: string) => selectedTagNames.includes(t));
        if (!hasTag) return false;
      }

      // Date range filter
      if (dateRangeFrom) {
        const noteDate = n.Created ? n.Created.slice(0, 10) : '';
        if (noteDate < dateRangeFrom) return false;
      }
      if (dateRangeTo) {
        const noteDate = n.Created ? n.Created.slice(0, 10) : '';
        if (noteDate > dateRangeTo) return false;
      }

      return true;
    });
  }, [allNotes, selectedTagNames, dateRangeFrom, dateRangeTo]);

  const toggleTagSelection = (tagName: string) => {
    setSelectedTagNames((prev) =>
      prev.includes(tagName) ? prev.filter((t) => t !== tagName) : [...prev, tagName]
    );
  };

  // Build and export a selective .jwlibrary
  const handleExportSelective = async () => {
    if (!activeDb || matchingNotes.length === 0) return;

    try {
      setIsExporting(true);
      setExportComplete(false);

      // Create a fresh clean SQLite database in-memory
      const cleanDb = await openDatabase();

      // Recreate exact schema from the active database to ensure JW Library compatibility
      const schemaRows = queryAll<{ sql: string }>(
        activeDb,
        "SELECT sql FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'"
      );
      
      for (const row of schemaRows) {
        if (row.sql) {
          execute(cleanDb, row.sql);
        }
      }

      // Populate required metadata table LastModified
      if (schemaRows.some((r) => r.sql && r.sql.includes('LastModified'))) {
        execute(cleanDb, "INSERT INTO LastModified (LastModified) VALUES (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))");
      }

      const noteIds = matchingNotes.map((n) => n.NoteId);
      const idList = noteIds.join(',');

      // Copy matching Notes and their Locations & Tags
      const origNotes = queryAll<INote>(
        activeDb,
        `SELECT * FROM Note WHERE NoteId IN (${idList})`
      );

      const locationIdMap = new Map<number, number>();
      const tagIdMap = new Map<number, number>();

      for (const note of origNotes) {
        let cleanLocId: number | null = null;
        if (note.LocationId) {
          if (locationIdMap.has(note.LocationId)) {
            cleanLocId = locationIdMap.get(note.LocationId)!;
          } else {
            const loc = queryAll<ILocation>(
              activeDb,
              'SELECT * FROM Location WHERE LocationId = :id',
              { ':id': note.LocationId }
            )[0];
            if (loc) {
              execute(
                cleanDb,
                `INSERT INTO Location (BookNumber, ChapterNumber, DocumentId, Track, IssueTagNumber, KeySymbol, MepsLanguage, Type, Title)
                 VALUES (:b, :c, :d, :tr, :i, :k, :m, :ty, :t)`,
                {
                  ':b': loc.BookNumber,
                  ':c': loc.ChapterNumber,
                  ':d': loc.DocumentId,
                  ':tr': loc.Track,
                  ':i': loc.IssueTagNumber ?? 0,
                  ':k': loc.KeySymbol,
                  ':m': loc.MepsLanguage ?? 0,
                  ':ty': loc.Type ?? 0,
                  ':t': loc.Title,
                }
              );
              const lastLocRow = queryAll<{ id: number }>(
                cleanDb,
                'SELECT last_insert_rowid() AS id'
              )[0];
              cleanLocId = lastLocRow?.id || null;
              if (cleanLocId) locationIdMap.set(note.LocationId, cleanLocId);
            }
          }
        }

        // Insert Note
        execute(
          cleanDb,
          `INSERT INTO Note (Guid, UserMarkId, LocationId, Title, Content, LastModified, Created, BlockType, BlockIdentifier)
           VALUES (:g, :um, :loc, :t, :c, :lm, :cr, :bt, :bi)`,
          {
            ':g': note.Guid,
            ':um': null, // Omit raw usermark in lightweight note share
            ':loc': cleanLocId,
            ':t': note.Title,
            ':c': note.Content,
            ':lm': note.LastModified,
            ':cr': note.Created,
            ':bt': note.BlockType ?? 0,
            ':bi': note.BlockIdentifier,
          }
        );
        const newNoteRow = queryAll<{ id: number }>(
          cleanDb,
          'SELECT last_insert_rowid() AS id'
        )[0];
        const cleanNoteId = newNoteRow?.id;

        // Copy Note's TagMaps & Tags
        const origTagMaps = queryAll<ITagMap>(
          activeDb,
          'SELECT * FROM TagMap WHERE NoteId = :id',
          { ':id': note.NoteId }
        );

        for (const tm of origTagMaps) {
          let cleanTagId: number | null = null;
          if (tagIdMap.has(tm.TagId)) {
            cleanTagId = tagIdMap.get(tm.TagId)!;
          } else {
            const tagObj = queryAll<ITag>(
              activeDb,
              'SELECT * FROM Tag WHERE TagId = :id',
              { ':id': tm.TagId }
            )[0];
            if (tagObj) {
              execute(cleanDb, 'INSERT INTO Tag (Type, Name) VALUES (:ty, :name)', {
                ':ty': tagObj.Type ?? 1,
                ':name': tagObj.Name,
              });
              const lastTagRow = queryAll<{ id: number }>(
                cleanDb,
                'SELECT last_insert_rowid() AS id'
              )[0];
              cleanTagId = lastTagRow?.id || null;
              if (cleanTagId) tagIdMap.set(tm.TagId, cleanTagId);
            }
          }

          if (cleanTagId && cleanNoteId) {
            execute(
              cleanDb,
              'INSERT INTO TagMap (NoteId, TagId, LocationId, Position) VALUES (:nid, :tid, NULL, :pos)',
              {
                ':nid': cleanNoteId,
                ':tid': cleanTagId,
                ':pos': tm.Position ?? 0,
              }
            );
          }
        }
      }

      const cleanBytes = exportDatabase(cleanDb);
      cleanDb.close();

      const selectiveManifest = await createOrUpdateManifest(cleanBytes, activeManifest, {
        name: exportName || 'Shared Study Notes',
        deviceName: 'JW Sync Selective Share',
      });

      const zipBlob = await packageJwLibrary(cleanBytes, selectiveManifest);

      // Download
      const url = URL.createObjectURL(zipBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${exportName.replace(/[^a-z0-9_\-]/gi, '_')}.jwlibrary`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      setIsExporting(false);
      setExportComplete(true);
    } catch (err) {
      setIsExporting(false);
      alert('Failed to export selective package: ' + (err as Error).message);
    }
  };

  if (!activeDb || !summary) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-20 text-center space-y-6">
        <div className="w-16 h-16 rounded-3xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-600 dark:text-blue-400 mx-auto">
          <Share2 className="w-8 h-8" />
        </div>
        <div className="space-y-2">
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">{t('share.noDataTitle')}</h1>
          <p className="text-xs text-slate-600 dark:text-slate-400">
            {t('share.noDataPrompt')}
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="w-full sm:w-auto inline-flex items-center justify-center space-x-2 px-5 py-3 rounded-2xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs tracking-wide transition-all shadow-md shadow-blue-600/30"
          >
            <Upload className="w-4 h-4" />
            <span>{t('share.openFileBtn', 'Open .jwlibrary File')}</span>
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".jwlibrary"
            className="hidden"
            onChange={async (e) => {
              const file = e.target.files?.[0];
              if (file) await useAppStore.getState().loadLibrary(file);
            }}
          />
          <button
            type="button"
            onClick={() => useCloudStore.getState().setShowCloudModal(true)}
            className="w-full sm:w-auto inline-flex items-center justify-center space-x-2 px-5 py-3 rounded-2xl bg-slate-100 hover:bg-slate-200 dark:bg-white/[0.04] dark:hover:bg-white/[0.08] text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-white/[0.08] text-xs font-semibold transition-all shadow-sm"
          >
            <Cloud className="w-4 h-4 text-blue-500" />
            <span>{t('merge.chooseFromDrive', 'Choose from Google Drive')}</span>
          </button>
        </div>

        <div className="pt-4">
          <button
            type="button"
            onClick={loadDemoLibrary}
            disabled={isLoading}
            className="inline-flex items-center space-x-1.5 text-xs text-slate-500 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 font-medium underline"
          >
            <Sparkles className="w-3.5 h-3.5 text-blue-500" />
            <span>{t('share.tryDemoBtn', 'Try Demo Library')}</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* ── HEADER ────────────────────────────────────────────────────── */}
      <div className="space-y-1 border-b border-slate-200 dark:border-slate-800 pb-6">
        <div className="inline-flex items-center space-x-2 text-xs font-semibold text-orange-500 dark:text-orange-400 uppercase tracking-wider">
          <Share2 className="w-3.5 h-3.5" />
          <span>{t('share.title')}</span>
        </div>
        <h1 className="text-3xl font-extrabold text-slate-900 dark:text-white">{t('share.headline')}</h1>
        <p className="text-sm text-slate-600 dark:text-slate-400 max-w-3xl">
          {t('share.subtitle')}
        </p>
      </div>

      {/* ── FILTER & SELECTION PANEL ──────────────────────────────────── */}
      <div className="border border-slate-200 dark:border-slate-800 rounded-xl bg-white dark:bg-slate-900 p-4 sm:p-6 space-y-6 shadow-sm">
        <div className="space-y-3">
          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300">
            {t('share.selectTagsTitle')}
          </label>

          {availableTags.length === 0 ? (
            <p className="text-xs text-slate-500">{t('share.noTagsFound')}</p>
          ) : (
            <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
              {availableTags.map((tItem) => {
                const isSelected = selectedTagNames.includes(tItem.Name);
                return (
                  <button
                    key={tItem.TagId}
                    type="button"
                    onClick={() => toggleTagSelection(tItem.Name)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors flex items-center space-x-1.5 ${
                      isSelected
                        ? 'bg-orange-600 border-orange-500 text-white shadow-sm'
                        : 'bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:border-slate-400'
                    }`}
                  >
                    <span>#{tItem.Name}</span>
                    <span className="text-[10px] opacity-75 font-mono">({tItem.count})</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Date range filter */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t border-slate-200 dark:border-slate-800">
          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
              {t('share.createdFrom')}
            </label>
            <input
              type="date"
              value={dateRangeFrom}
              onChange={(e) => setDateRangeFrom(e.target.value)}
              className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-md px-3 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-orange-500 shadow-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
              {t('share.createdTo')}
            </label>
            <input
              type="date"
              value={dateRangeTo}
              onChange={(e) => setDateRangeTo(e.target.value)}
              className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-md px-3 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-orange-500 shadow-sm"
            />
          </div>
        </div>

        {/* Export Name */}
        <div className="pt-4 border-t border-slate-200 dark:border-slate-800">
          <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
            {t('share.exportFilename')}
          </label>
          <input
            type="text"
            value={exportName}
            onChange={(e) => setExportName(e.target.value)}
            className="w-full sm:w-80 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-md px-3 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-orange-500 shadow-sm"
          />
        </div>
      </div>

      {/* ── PRIVACY & SUMMARY STATS ────────────────────────────────────── */}
      <div className="border border-emerald-500/30 bg-emerald-50/70 dark:bg-emerald-950/10 rounded-xl p-5 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-sm">
        <div className="flex items-center space-x-3">
          <Lock className="w-5 h-5 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
          <div className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
            <strong className="text-slate-900 dark:text-white">{t('share.privacyGuaranteeTitle')} </strong>
            {t('share.privacyGuaranteeDesc')}
          </div>
        </div>

        <button
          type="button"
          onClick={handleExportSelective}
          disabled={isExporting || matchingNotes.length === 0}
          className="w-full sm:w-auto inline-flex items-center justify-center space-x-2 px-6 py-3 rounded-lg bg-orange-600 hover:bg-orange-500 disabled:opacity-50 text-white font-semibold text-xs transition-colors flex-shrink-0 shadow-sm"
        >
          <Download className="w-4 h-4" />
          <span>{isExporting ? t('share.packaging') : t('share.exportNotesBtn', { count: matchingNotes.length })}</span>
        </button>
      </div>

      {/* ── PREVIEW OF MATCHING NOTES ──────────────────────────────────── */}
      <div className="space-y-3">
        <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
          <span className="font-semibold text-slate-700 dark:text-slate-300">
            {t('share.previewBundle', { count: matchingNotes.length })}
          </span>
        </div>

        <div className="space-y-2">
          {matchingNotes.map((note) => (
            <div
              key={note.NoteId}
              className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-3 text-xs flex items-center justify-between gap-4 shadow-sm"
            >
              <div className="space-y-0.5 truncate">
                <div className="font-semibold text-slate-900 dark:text-white truncate">
                  {note.Title || t('share.untitledNote')}
                </div>
                <div className="text-slate-500 dark:text-slate-400 text-[11px] truncate">
                  {note.locationTitle || t('explorer.personalNote')} • {note.Content?.slice(0, 70)}...
                </div>
              </div>

              <div className="flex items-center space-x-1 flex-shrink-0">
                {note.tags.map((tItem: string) => (
                  <span
                    key={tItem}
                    className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-950 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-800 text-[10px]"
                  >
                    #{tItem}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
