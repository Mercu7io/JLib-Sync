import React, { useState } from 'react';
import {
  FileText,
  Copy,
  Highlighter,
  Tag,
  Bookmark,
  ListMusic,
  ChevronDown,
  ListFilter,
  AlertCircle,
  RefreshCw,
  Edit2,
  RotateCcw,
  Check,
  X,
} from 'lucide-react';
import { IMergeResult } from '../../lib/jw/merge';
import { IMergeDetailedNote } from '../../lib/jw/types';
import { useTranslation } from 'react-i18next';

const HIGHLIGHT_COLOR_MAP: Record<number, { bg: string; name: string; border: string }> = {
  1: { bg: 'bg-yellow-400', border: 'border-yellow-500', name: 'Yellow' },
  2: { bg: 'bg-emerald-500', border: 'border-emerald-600', name: 'Green' },
  3: { bg: 'bg-blue-500', border: 'border-blue-600', name: 'Blue' },
  4: { bg: 'bg-pink-500', border: 'border-pink-600', name: 'Pink' },
  5: { bg: 'bg-orange-500', border: 'border-orange-600', name: 'Orange' },
  6: { bg: 'bg-purple-500', border: 'border-purple-600', name: 'Purple' },
};

export interface IMergeDetailedBreakdownProps {
  mergeResult: IMergeResult;
  candidateNotes: IMergeDetailedNote[];
  candidateDuplicates?: IMergeDetailedNote[];
  excludedNoteGuids: Set<string>;
  noteOverrides: Record<string, { title?: string; content?: string }>;
  toggleNoteExclusion: (guid: string) => void;
  setNoteOverride: (guid: string, override: { title?: string; content?: string } | null) => void;
  setExcludedNoteGuids: React.Dispatch<React.SetStateAction<Set<string>>>;
  showDetails: boolean;
  setShowDetails: React.Dispatch<React.SetStateAction<boolean>>;
  hasUnsavedChanges: boolean;
  onRemerge: () => void;
  isMerging: boolean;
}

export const MergeDetailedBreakdown: React.FC<IMergeDetailedBreakdownProps> = ({
  mergeResult,
  candidateNotes,
  candidateDuplicates = [],
  excludedNoteGuids,
  noteOverrides,
  toggleNoteExclusion,
  setNoteOverride,
  setExcludedNoteGuids,
  showDetails,
  setShowDetails,
  hasUnsavedChanges,
  onRemerge,
  isMerging,
}) => {
  const { t } = useTranslation();

  // Accordion open/close state
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    notes: true,
    duplicates: false,
    highlights: false,
    tags: false,
    bookmarks: false,
    playlists: false,
  });

  // Note being edited in modal
  const [editingNote, setEditingNote] = useState<IMergeDetailedNote | null>(null);
  const [editTitle, setEditTitle] = useState<string>('');
  const [editContent, setEditContent] = useState<string>('');

  const toggleSection = (key: string) => {
    setOpenSections((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleOpenEditModal = (note: IMergeDetailedNote, e: React.MouseEvent) => {
    e.stopPropagation();
    const existingOverride = noteOverrides[note.guid];
    setEditingNote(note);
    setEditTitle(existingOverride?.title !== undefined ? existingOverride.title : note.title);
    setEditContent(existingOverride?.content !== undefined ? existingOverride.content : note.content);
  };

  const handleSaveEdit = () => {
    if (!editingNote) return;
    setNoteOverride(editingNote.guid, {
      title: editTitle,
      content: editContent,
    });
    setEditingNote(null);
  };

  const handleResetEdit = (guid: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setNoteOverride(guid, null);
  };

  // Select all / Deselect all for notes
  const effectiveNotes = candidateNotes.length > 0 ? candidateNotes : mergeResult.details.addedNotes;
  const effectiveDuplicates = candidateDuplicates.length > 0 ? candidateDuplicates : mergeResult.details.unifiedDuplicates;

  const handleIncludeAllNotes = (e: React.MouseEvent) => {
    e.stopPropagation();
    setExcludedNoteGuids((prev) => {
      const next = new Set(prev);
      effectiveNotes.forEach((n) => next.delete(n.guid));
      return next;
    });
  };

  const handleExcludeAllNotes = (e: React.MouseEvent) => {
    e.stopPropagation();
    setExcludedNoteGuids((prev) => {
      const next = new Set(prev);
      effectiveNotes.forEach((n) => next.add(n.guid));
      return next;
    });
  };

  const notesIncludedCount = effectiveNotes.filter((n) => !excludedNoteGuids.has(n.guid)).length;
  const editedNotesCount = Object.keys(noteOverrides).length;

  return (
    <div className="space-y-4 pt-1">
      {/* ── Toggle Detailed Breakdown Button & Summary Badge ────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-2.5">
        <button
          type="button"
          onClick={() => setShowDetails((prev) => !prev)}
          className="inline-flex items-center space-x-2 text-xs font-bold px-4 py-2.5 rounded-2xl bg-slate-100 hover:bg-slate-200/80 dark:bg-white/[0.05] dark:hover:bg-white/[0.09] text-slate-800 dark:text-slate-200 border border-slate-200/80 dark:border-white/[0.08] transition-all cursor-pointer shadow-sm"
        >
          <ListFilter className="w-4 h-4 text-blue-600 dark:text-blue-400" />
          <span>{showDetails ? t('merge.hideDetailedBreakdown') : t('merge.viewDetailedBreakdown')}</span>
          <ChevronDown
            className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${showDetails ? 'rotate-180' : ''}`}
          />
        </button>

        <div className="flex items-center gap-2">
          {excludedNoteGuids.size > 0 && (
            <span className="text-[11px] px-2.5 py-1 rounded-full bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/25 font-bold">
              {excludedNoteGuids.size} {t('merge.categoryNewNotes', 'note(s)')} {t('merge.noteEdited', 'exclue(s)')}
            </span>
          )}
          {editedNotesCount > 0 && (
            <span className="text-[11px] px-2.5 py-1 rounded-full bg-blue-500/10 text-blue-700 dark:text-blue-400 border border-blue-500/25 font-bold">
              {editedNotesCount} {t('merge.noteEdited')}
            </span>
          )}
        </div>
      </div>

      {/* ── Detailed Breakdown Body ────────────────────────────────────────── */}
      {showDetails && (
        <div className="space-y-3.5 pt-1 animate-in fade-in-50 duration-200">
          {/* Unsaved Changes Alert Bar with Re-merge Action */}
          {hasUnsavedChanges && (
            <div className="p-4 bg-amber-500/10 dark:bg-amber-950/30 border border-amber-500/30 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-amber-900 dark:text-amber-200 shadow-sm">
              <div className="flex items-start sm:items-center space-x-2.5">
                <AlertCircle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5 sm:mt-0" />
                <div className="space-y-0.5">
                  <div className="font-bold">
                    {excludedNoteGuids.size > 0
                      ? t('merge.remergeWithExclusions', { count: excludedNoteGuids.size })
                      : t('merge.allNotesIncluded')}
                  </div>
                  {editedNotesCount > 0 && (
                    <div className="text-[11px] text-amber-700 dark:text-amber-300">
                      {editedNotesCount} {t('merge.noteEdited').toLowerCase()}
                    </div>
                  )}
                </div>
              </div>
              <button
                type="button"
                onClick={onRemerge}
                disabled={isMerging}
                className="inline-flex items-center justify-center space-x-2 px-4 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs shadow-md transition-all flex-shrink-0 cursor-pointer disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isMerging ? 'animate-spin' : ''}`} />
                <span>{isMerging ? t('merge.merging') : t('merge.remergeAction')}</span>
              </button>
            </div>
          )}

          {/* ── Accordion 1: New Notes Added ───────────────────────────────── */}
          <div className="rounded-2xl border border-slate-200 dark:border-white/[0.08] bg-slate-50/60 dark:bg-white/[0.02] overflow-hidden shadow-sm">
            <button
              type="button"
              onClick={() => toggleSection('notes')}
              className="w-full px-4 py-3.5 flex items-center justify-between text-left hover:bg-slate-100/60 dark:hover:bg-white/[0.04] transition-colors cursor-pointer"
            >
              <div className="flex items-center space-x-2.5">
                <FileText className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                <span className="text-xs font-bold text-slate-900 dark:text-slate-100">
                  {t('merge.categoryNewNotes')}
                </span>
                <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 font-bold">
                  {effectiveNotes.length}
                </span>
              </div>
              <ChevronDown
                className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${
                  openSections.notes ? 'rotate-180' : ''
                }`}
              />
            </button>

            {openSections.notes && (
              <div className="p-3.5 pt-0 space-y-2.5 border-t border-slate-200/60 dark:border-white/[0.04]">
                {/* Header Toolbar */}
                <div className="text-[11px] text-slate-500 dark:text-slate-400 pt-2 pb-1 flex flex-wrap items-center justify-between gap-2">
                  <span className="font-medium">{t('merge.uncheckToExclude')}</span>
                  <div className="flex items-center space-x-3 text-[10px] font-semibold">
                    <span className="text-slate-600 dark:text-slate-300">
                      {notesIncludedCount} / {effectiveNotes.length} {t('merge.checkedToInclude', 'incluses')}
                    </span>
                    <span>•</span>
                    <button
                      type="button"
                      onClick={handleIncludeAllNotes}
                      className="text-blue-600 hover:text-blue-500 dark:text-blue-400 cursor-pointer"
                    >
                      {t('merge.selectAll')}
                    </button>
                    <span>•</span>
                    <button
                      type="button"
                      onClick={handleExcludeAllNotes}
                      className="text-slate-500 hover:text-red-500 dark:text-slate-400 cursor-pointer"
                    >
                      {t('merge.deselectAll')}
                    </button>
                  </div>
                </div>

                {/* Notes list */}
                {effectiveNotes.map((note) => {
                  const isExcluded = excludedNoteGuids.has(note.guid);
                  const override = noteOverrides[note.guid];
                  const hasOverride = !!override;
                  const displayTitle = override?.title !== undefined ? override.title : note.title;
                  const displayContent = override?.content !== undefined ? override.content : note.content;

                  return (
                    <div
                      key={note.guid}
                      onClick={() => toggleNoteExclusion(note.guid)}
                      className={`p-3 rounded-xl border transition-all cursor-pointer flex items-start space-x-3 ${
                        isExcluded
                          ? 'bg-red-50/40 dark:bg-red-950/15 border-red-200/60 dark:border-red-900/30 opacity-65'
                          : 'bg-white dark:bg-[#141b2d] border-slate-200/80 dark:border-white/[0.06] hover:border-blue-500/40'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={!isExcluded}
                        onChange={() => {}} // Click handled by wrapper div
                        className="mt-1 w-4 h-4 rounded text-blue-600 focus:ring-blue-500 cursor-pointer flex-shrink-0"
                      />

                      <div className="min-w-0 flex-1 space-y-1">
                        <div className="flex items-center justify-between gap-2">
                          <div
                            className={`text-xs font-bold truncate ${
                              isExcluded
                                ? 'line-through text-slate-400 dark:text-slate-500'
                                : 'text-slate-900 dark:text-slate-100'
                            }`}
                          >
                            {displayTitle || '(Untitled Note)'}
                          </div>

                          <div className="flex items-center space-x-1.5 flex-shrink-0">
                            {hasOverride && (
                              <span className="text-[9px] px-1.5 py-0.5 rounded font-bold bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
                                {t('merge.noteEdited')}
                              </span>
                            )}
                            <span
                              className={`text-[9px] px-1.5 py-0.5 rounded font-bold ${
                                isExcluded
                                  ? 'bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20'
                                  : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                              }`}
                            >
                              {isExcluded ? 'Exclu' : 'Inclus'}
                            </span>
                            <button
                              type="button"
                              title={t('merge.editNote')}
                              onClick={(e) => handleOpenEditModal(note, e)}
                              className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-white/[0.08] text-slate-500 hover:text-blue-600 dark:text-slate-400 dark:hover:text-blue-400 transition-colors"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            {hasOverride && (
                              <button
                                type="button"
                                title={t('merge.resetToOriginal')}
                                onClick={(e) => handleResetEdit(note.guid, e)}
                                className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-white/[0.08] text-slate-500 hover:text-amber-600 dark:text-slate-400 dark:hover:text-amber-400 transition-colors"
                              >
                                <RotateCcw className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </div>

                        {note.locationTitle && (
                          <div className="text-[10px] text-blue-600 dark:text-blue-400 font-semibold truncate">
                            📍 {note.locationTitle}
                          </div>
                        )}

                        {displayContent && (
                          <p
                            className={`text-[11px] line-clamp-2 whitespace-pre-wrap ${
                              isExcluded
                                ? 'text-slate-400 dark:text-slate-600 line-through'
                                : 'text-slate-600 dark:text-slate-400'
                            }`}
                          >
                            {displayContent}
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}

                {effectiveNotes.length === 0 && (
                  <div className="text-center py-5 text-xs text-slate-400">
                    {t('merge.noItems')}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* ── Accordion 2: Duplicates Unified ────────────────────────────── */}
          <div className="rounded-2xl border border-slate-200 dark:border-white/[0.08] bg-slate-50/60 dark:bg-white/[0.02] overflow-hidden shadow-sm">
            <button
              type="button"
              onClick={() => toggleSection('duplicates')}
              className="w-full px-4 py-3.5 flex items-center justify-between text-left hover:bg-slate-100/60 dark:hover:bg-white/[0.04] transition-colors cursor-pointer"
            >
              <div className="flex items-center space-x-2.5">
                <Copy className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                <span className="text-xs font-bold text-slate-900 dark:text-slate-100">
                  {t('merge.categoryDuplicates')}
                </span>
                <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 font-bold">
                  {effectiveDuplicates.length}
                </span>
              </div>
              <ChevronDown
                className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${
                  openSections.duplicates ? 'rotate-180' : ''
                }`}
              />
            </button>

            {openSections.duplicates && (
              <div className="p-3.5 pt-0 space-y-2.5 border-t border-slate-200/60 dark:border-white/[0.04]">
                <div className="text-[11px] text-slate-500 dark:text-slate-400 pt-2 pb-1">
                  {t('merge.categoryDuplicates')} ({effectiveDuplicates.length})
                </div>

                {effectiveDuplicates.map((dup, idx) => {
                  const isExcluded = excludedNoteGuids.has(dup.guid);
                  return (
                    <div
                      key={dup.guid || idx}
                      onClick={() => toggleNoteExclusion(dup.guid)}
                      className={`p-3 rounded-xl border transition-all cursor-pointer flex items-start space-x-3 ${
                        isExcluded
                          ? 'bg-red-50/40 dark:bg-red-950/15 border-red-200/60 dark:border-red-900/30 opacity-65'
                          : 'bg-white dark:bg-[#141b2d] border-slate-200/80 dark:border-white/[0.06] hover:border-emerald-500/40'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={!isExcluded}
                        onChange={() => {}}
                        className="mt-1 w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer flex-shrink-0"
                      />
                      <div className="min-w-0 flex-1 space-y-1">
                        <div className="flex items-center justify-between gap-2">
                          <span
                            className={`text-xs font-bold truncate ${
                              isExcluded
                                ? 'line-through text-slate-400 dark:text-slate-500'
                                : 'text-slate-900 dark:text-slate-100'
                            }`}
                          >
                            {dup.title || '(Untitled Note)'}
                          </span>
                          <span
                            className={`text-[9px] px-1.5 py-0.5 rounded font-bold flex-shrink-0 ${
                              isExcluded
                                ? 'bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20'
                                : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                            }`}
                          >
                            {isExcluded ? 'Exclu' : 'Unifié'}
                          </span>
                        </div>
                        {dup.locationTitle && (
                          <div className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold">
                            📍 {dup.locationTitle}
                          </div>
                        )}
                        {dup.content && (
                          <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-1">
                            {dup.content}
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}

                {effectiveDuplicates.length === 0 && (
                  <div className="text-center py-5 text-xs text-slate-400">
                    {t('merge.noItems')}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* ── Accordion 3: Highlights Combined ──────────────────────────── */}
          <div className="rounded-2xl border border-slate-200 dark:border-white/[0.08] bg-slate-50/60 dark:bg-white/[0.02] overflow-hidden shadow-sm">
            <button
              type="button"
              onClick={() => toggleSection('highlights')}
              className="w-full px-4 py-3.5 flex items-center justify-between text-left hover:bg-slate-100/60 dark:hover:bg-white/[0.04] transition-colors cursor-pointer"
            >
              <div className="flex items-center space-x-2.5">
                <Highlighter className="w-4 h-4 text-amber-500" />
                <span className="text-xs font-bold text-slate-900 dark:text-slate-100">
                  {t('merge.categoryHighlights')}
                </span>
                <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 font-bold">
                  {mergeResult.details.combinedHighlights.length}
                </span>
              </div>
              <ChevronDown
                className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${
                  openSections.highlights ? 'rotate-180' : ''
                }`}
              />
            </button>

            {openSections.highlights && (
              <div className="p-3.5 pt-0 space-y-2 border-t border-slate-200/60 dark:border-white/[0.04]">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2">
                  {mergeResult.details.combinedHighlights.map((hl, idx) => {
                    const colorInfo = HIGHLIGHT_COLOR_MAP[hl.colorIndex] || {
                      bg: 'bg-yellow-400',
                      name: 'Yellow',
                      border: 'border-yellow-500',
                    };
                    return (
                      <div
                        key={idx}
                        className="p-2.5 rounded-xl bg-white dark:bg-[#141b2d] border border-slate-200/80 dark:border-white/[0.06] flex items-center space-x-2.5"
                      >
                        <span className={`w-3.5 h-3.5 rounded-full ${colorInfo.bg} shadow-sm flex-shrink-0`} />
                        <div className="min-w-0 flex-1">
                          <div className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate">
                            {hl.locationTitle || 'Bible / Publication'}
                          </div>
                          <div className="text-[10px] text-slate-400">
                            {colorInfo.name} highlight
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {mergeResult.details.combinedHighlights.length === 0 && (
                  <div className="text-center py-5 text-xs text-slate-400">
                    {t('merge.noItems')}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* ── Accordion 4: Tags Consolidated ────────────────────────────── */}
          <div className="rounded-2xl border border-slate-200 dark:border-white/[0.08] bg-slate-50/60 dark:bg-white/[0.02] overflow-hidden shadow-sm">
            <button
              type="button"
              onClick={() => toggleSection('tags')}
              className="w-full px-4 py-3.5 flex items-center justify-between text-left hover:bg-slate-100/60 dark:hover:bg-white/[0.04] transition-colors cursor-pointer"
            >
              <div className="flex items-center space-x-2.5">
                <Tag className="w-4 h-4 text-indigo-500" />
                <span className="text-xs font-bold text-slate-900 dark:text-slate-100">
                  {t('merge.categoryTags')}
                </span>
                <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20 font-bold">
                  {mergeResult.details.consolidatedTags.length}
                </span>
              </div>
              <ChevronDown
                className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${
                  openSections.tags ? 'rotate-180' : ''
                }`}
              />
            </button>

            {openSections.tags && (
              <div className="p-3.5 pt-0 border-t border-slate-200/60 dark:border-white/[0.04]">
                <div className="flex flex-wrap gap-2 pt-2">
                  {mergeResult.details.consolidatedTags.map((tg, idx) => (
                    <span
                      key={idx}
                      className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-indigo-50/80 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-800/40 text-xs font-semibold text-indigo-800 dark:text-indigo-300"
                    >
                      <span>🏷️ {tg.name}</span>
                      <span className="text-[9px] px-1.5 py-0.2 rounded-md bg-indigo-200/60 dark:bg-indigo-900/60 text-indigo-900 dark:text-indigo-200 uppercase tracking-wider font-bold">
                        {tg.action === 'created' ? 'new' : 'merged'}
                      </span>
                    </span>
                  ))}
                </div>

                {mergeResult.details.consolidatedTags.length === 0 && (
                  <div className="text-center py-5 text-xs text-slate-400">
                    {t('merge.noItems')}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* ── Accordion 5: Bookmarks Added ──────────────────────────────── */}
          <div className="rounded-2xl border border-slate-200 dark:border-white/[0.08] bg-slate-50/60 dark:bg-white/[0.02] overflow-hidden shadow-sm">
            <button
              type="button"
              onClick={() => toggleSection('bookmarks')}
              className="w-full px-4 py-3.5 flex items-center justify-between text-left hover:bg-slate-100/60 dark:hover:bg-white/[0.04] transition-colors cursor-pointer"
            >
              <div className="flex items-center space-x-2.5">
                <Bookmark className="w-4 h-4 text-teal-500" />
                <span className="text-xs font-bold text-slate-900 dark:text-slate-100">
                  {t('merge.categoryBookmarks')}
                </span>
                <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-teal-500/10 text-teal-600 dark:text-teal-400 border border-teal-500/20 font-bold">
                  {mergeResult.details.addedBookmarks.length}
                </span>
              </div>
              <ChevronDown
                className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${
                  openSections.bookmarks ? 'rotate-180' : ''
                }`}
              />
            </button>

            {openSections.bookmarks && (
              <div className="p-3.5 pt-0 space-y-2 border-t border-slate-200/60 dark:border-white/[0.04]">
                {mergeResult.details.addedBookmarks.map((bm, idx) => (
                  <div
                    key={idx}
                    className="p-2.5 rounded-xl bg-white dark:bg-[#141b2d] border border-slate-200/80 dark:border-white/[0.06] flex items-center justify-between text-xs"
                  >
                    <div className="truncate pr-2">
                      <div className="font-bold text-slate-800 dark:text-slate-200 truncate">
                        {bm.title || `Bookmark`}
                      </div>
                      {bm.locationTitle && (
                        <div className="text-[10px] text-slate-400 truncate">
                          📍 {bm.locationTitle}
                        </div>
                      )}
                    </div>
                    <span className="text-[10px] px-2 py-0.5 rounded bg-teal-500/10 text-teal-600 dark:text-teal-400 border border-teal-500/20 font-semibold">
                      Slot {bm.slot}
                    </span>
                  </div>
                ))}

                {mergeResult.details.addedBookmarks.length === 0 && (
                  <div className="text-center py-5 text-xs text-slate-400">
                    {t('merge.noItems')}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* ── Accordion 6: Playlists Merged ─────────────────────────────── */}
          <div className="rounded-2xl border border-slate-200 dark:border-white/[0.08] bg-slate-50/60 dark:bg-white/[0.02] overflow-hidden shadow-sm">
            <button
              type="button"
              onClick={() => toggleSection('playlists')}
              className="w-full px-4 py-3.5 flex items-center justify-between text-left hover:bg-slate-100/60 dark:hover:bg-white/[0.04] transition-colors cursor-pointer"
            >
              <div className="flex items-center space-x-2.5">
                <ListMusic className="w-4 h-4 text-purple-500" />
                <span className="text-xs font-bold text-slate-900 dark:text-slate-100">
                  {t('merge.categoryPlaylists')}
                </span>
                <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20 font-bold">
                  {mergeResult.details.mergedPlaylists.length}
                </span>
              </div>
              <ChevronDown
                className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${
                  openSections.playlists ? 'rotate-180' : ''
                }`}
              />
            </button>

            {openSections.playlists && (
              <div className="p-3.5 pt-0 space-y-2 border-t border-slate-200/60 dark:border-white/[0.04]">
                {mergeResult.details.mergedPlaylists.map((pl, idx) => (
                  <div
                    key={idx}
                    className="p-2.5 rounded-xl bg-white dark:bg-[#141b2d] border border-slate-200/80 dark:border-white/[0.06] text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center space-x-2"
                  >
                    <ListMusic className="w-4 h-4 text-purple-500 flex-shrink-0" />
                    <span className="truncate">{pl.name}</span>
                  </div>
                ))}

                {mergeResult.details.mergedPlaylists.length === 0 && (
                  <div className="text-center py-5 text-xs text-slate-400">
                    {t('merge.noItems')}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Edit Note Modal ──────────────────────────────────────────────── */}
      {editingNote && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#111726] border border-slate-200 dark:border-white/[0.1] rounded-3xl max-w-lg w-full p-6 space-y-4 shadow-2xl animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-white/[0.06]">
              <div className="flex items-center space-x-2 text-sm font-bold text-slate-900 dark:text-white">
                <Edit2 className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                <span>{t('merge.editNoteTitle')}</span>
              </div>
              <button
                type="button"
                onClick={() => setEditingNote(null)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-white p-1 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {editingNote.locationTitle && (
              <div className="text-xs text-blue-600 dark:text-blue-400 font-semibold">
                📍 {editingNote.locationTitle}
              </div>
            )}

            <div className="space-y-3">
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  {t('merge.noteTitleLabel')}
                </label>
                <input
                  type="text"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  placeholder="Note Title"
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-white/[0.1] bg-slate-50 dark:bg-white/[0.03] text-slate-900 dark:text-white text-xs font-medium focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  {t('merge.noteContentLabel')}
                </label>
                <textarea
                  rows={5}
                  value={editContent}
                  onChange={(e) => setEditContent(e.target.value)}
                  placeholder="Note Content"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-white/[0.1] bg-slate-50 dark:bg-white/[0.03] text-slate-900 dark:text-white text-xs font-normal focus:outline-none focus:ring-2 focus:ring-blue-500 font-sans leading-relaxed"
                />
              </div>
            </div>

            <div className="flex items-center justify-end space-x-2 pt-2 border-t border-slate-200 dark:border-white/[0.06]">
              <button
                type="button"
                onClick={() => setEditingNote(null)}
                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-white/[0.05] dark:hover:bg-white/[0.08] text-slate-700 dark:text-slate-300 text-xs font-bold transition-all"
              >
                {t('merge.cancel')}
              </button>
              <button
                type="button"
                onClick={handleSaveEdit}
                className="inline-flex items-center space-x-1.5 px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold shadow-md shadow-blue-600/30 transition-all"
              >
                <Check className="w-3.5 h-3.5" />
                <span>{t('merge.saveChanges')}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
