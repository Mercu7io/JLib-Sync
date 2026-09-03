import React, { useMemo, useRef } from 'react';
import {
  BarChart3,
  BookOpen,
  Highlighter,
  Bookmark,
  Tag,
  HelpCircle,
  Calendar,
  Sparkles,
  Upload,
} from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import { queryAll } from '../lib/jw/sqlite';
import { HIGHLIGHT_COLORS } from '../lib/jw/tokenizer';
import { BIBLE_BOOKS } from '../lib/jw/locales';

export const StatsPage: React.FC = () => {
  const { activeDb, summary, loadDemoLibrary, isLoading } = useAppStore();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 1. Highlight Color Distribution
  const colorStats = useMemo(() => {
    if (!activeDb) return [];
    try {
      const rows = queryAll<{ ColorIndex: number; count: number }>(
        activeDb,
        `SELECT ColorIndex, COUNT(*) as count 
         FROM UserMark 
         GROUP BY ColorIndex 
         ORDER BY ColorIndex ASC`
      );

      const totalMarks = rows.reduce((acc, r) => acc + r.count, 0);

      return [1, 2, 3, 4, 5, 6].map((colorIdx) => {
        const found = rows.find((r) => r.ColorIndex === colorIdx);
        const count = found ? found.count : 0;
        const colorInfo = HIGHLIGHT_COLORS[colorIdx];
        const percentage = totalMarks > 0 ? Math.round((count / totalMarks) * 100) : 0;

        return {
          ...colorInfo,
          count,
          percentage,
        };
      });
    } catch (_) {
      return [];
    }
  }, [activeDb, summary]);

  // 2. Bible Book Distribution (Top 8 studied books)
  const bibleBookStats = useMemo(() => {
    if (!activeDb) return [];
    try {
      const rows = queryAll<{ BookNumber: number; count: number }>(
        activeDb,
        `SELECT l.BookNumber, COUNT(n.NoteId) as count
         FROM Note n
         JOIN Location l ON n.LocationId = l.LocationId
         WHERE l.BookNumber IS NOT NULL AND l.BookNumber > 0
         GROUP BY l.BookNumber
         ORDER BY count DESC
         LIMIT 8`
      );

      return rows.map((r) => ({
        bookNumber: r.BookNumber,
        bookName: BIBLE_BOOKS[r.BookNumber] || `Book #${r.BookNumber}`,
        count: r.count,
      }));
    } catch (_) {
      return [];
    }
  }, [activeDb, summary]);

  // 3. Top Tags
  const topTags = useMemo(() => {
    if (!activeDb) return [];
    try {
      return queryAll<{ Name: string; count: number }>(
        activeDb,
        `SELECT t.Name, COUNT(tm.TagMapId) as count
         FROM Tag t
         JOIN TagMap tm ON t.TagId = tm.TagId
         GROUP BY t.TagId, t.Name
         ORDER BY count DESC
         LIMIT 6`
      );
    } catch (_) {
      return [];
    }
  }, [activeDb, summary]);

  if (!activeDb || !summary) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-20 text-center space-y-6">
        <div className="w-16 h-16 rounded-2xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center text-orange-500 mx-auto">
          <BarChart3 className="w-8 h-8" />
        </div>
        <div className="space-y-2">
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">No Study Statistics Available</h1>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Open a .jwlibrary backup to view visual analytics on your highlight color categories, Bible reading distribution, and study trends.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="w-full sm:w-auto inline-flex items-center justify-center space-x-2 px-5 py-3 rounded-lg bg-orange-600 hover:bg-orange-500 text-white font-semibold text-sm transition-colors shadow-sm"
          >
            <Upload className="w-4 h-4" />
            <span>Open .jwlibrary File</span>
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
            onClick={loadDemoLibrary}
            disabled={isLoading}
            className="w-full sm:w-auto inline-flex items-center justify-center space-x-2 px-5 py-3 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-900 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700 text-sm font-medium transition-colors shadow-sm"
          >
            <Sparkles className="w-4 h-4 text-orange-500 dark:text-orange-400" />
            <span>Try Demo Library</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-10">
      {/* ── HEADER ────────────────────────────────────────────────────── */}
      <div className="space-y-1 border-b border-slate-200 dark:border-slate-800 pb-6">
        <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white">Study Analytics & Highlights</h1>
        <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400">
          Visual breakdown of your research habits across {summary.name} ({summary.deviceName}).
        </p>
      </div>

      {/* ── TOP METRICS CARDS ─────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 sm:gap-4">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3.5 sm:p-5 space-y-1 shadow-sm">
          <div className="flex items-center space-x-2 text-xs text-slate-500 dark:text-slate-400">
            <BookOpen className="w-4 h-4 text-orange-500 dark:text-orange-400" />
            <span>Personal Notes</span>
          </div>
          <div className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white">{summary.notesCount}</div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3.5 sm:p-5 space-y-1 shadow-sm">
          <div className="flex items-center space-x-2 text-xs text-slate-500 dark:text-slate-400">
            <Highlighter className="w-4 h-4 text-yellow-500 dark:text-yellow-400" />
            <span>Highlights</span>
          </div>
          <div className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white">{summary.userMarksCount}</div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3.5 sm:p-5 space-y-1 shadow-sm">
          <div className="flex items-center space-x-2 text-xs text-slate-500 dark:text-slate-400">
            <Tag className="w-4 h-4 text-sky-500 dark:text-sky-400" />
            <span>Tags</span>
          </div>
          <div className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white">{summary.tagsCount}</div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3.5 sm:p-5 space-y-1 shadow-sm">
          <div className="flex items-center space-x-2 text-xs text-slate-500 dark:text-slate-400">
            <Bookmark className="w-4 h-4 text-emerald-500 dark:text-emerald-400" />
            <span>Bookmarks</span>
          </div>
          <div className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white">{summary.bookmarksCount}</div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3.5 sm:p-5 space-y-1 col-span-2 sm:col-span-1 shadow-sm">
          <div className="flex items-center space-x-2 text-xs text-slate-500 dark:text-slate-400">
            <HelpCircle className="w-4 h-4 text-purple-500 dark:text-purple-400" />
            <span>Question Answers</span>
          </div>
          <div className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white">{summary.inputFieldsCount}</div>
        </div>
      </div>

      {/* ── HIGHLIGHT COLORS BREAKDOWN ─────────────────────────────────── */}
      <div className="border border-slate-200 dark:border-slate-800 rounded-xl bg-white dark:bg-slate-900 p-6 space-y-6 shadow-sm">
        <div className="space-y-1">
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">Highlights by Color & Intent</h2>
          <p className="text-xs text-slate-600 dark:text-slate-400">
            Adheres to the official study annotation convention (Yellow answers, Green principles, Blue tools, Pink heart, Orange actions, Purple warnings).
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {colorStats.map((c) => (
            <div
              key={c.index}
              className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800/80 rounded-lg p-4 space-y-2"
            >
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center space-x-2">
                  <span
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: c.hex }}
                  />
                  <span className="font-semibold text-slate-900 dark:text-white">{c.name}</span>
                  <span className="text-slate-500 dark:text-slate-400">({c.category})</span>
                </div>
                <div className="font-mono text-slate-700 dark:text-slate-200">
                  {c.count} ({c.percentage}%)
                </div>
              </div>

              {/* Progress bar */}
              <div className="w-full bg-slate-200 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-300"
                  style={{ width: `${c.percentage}%`, backgroundColor: c.hex }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── TOP SCRIPTURES & TAGS ─────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Top Bible Books */}
        <div className="border border-slate-200 dark:border-slate-800 rounded-xl bg-white dark:bg-slate-900 p-6 space-y-4 shadow-sm">
          <h3 className="text-base font-bold text-slate-900 dark:text-white">Most Studied Bible Books</h3>
          {bibleBookStats.length === 0 ? (
            <p className="text-xs text-slate-500">No scripture notes linked in this backup.</p>
          ) : (
            <div className="space-y-3">
              {bibleBookStats.map((b) => (
                <div key={b.bookNumber} className="flex items-center justify-between text-xs">
                  <span className="text-slate-700 dark:text-slate-300 font-medium">{b.bookName}</span>
                  <span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-orange-600 dark:text-orange-400 font-mono font-semibold">
                    {b.count} notes
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Top Tags */}
        <div className="border border-slate-200 dark:border-slate-800 rounded-xl bg-white dark:bg-slate-900 p-6 space-y-4 shadow-sm">
          <h3 className="text-base font-bold text-slate-900 dark:text-white">Top Research Tags</h3>
          {topTags.length === 0 ? (
            <p className="text-xs text-slate-500">No tags found in this backup.</p>
          ) : (
            <div className="space-y-3">
              {topTags.map((t) => (
                <div key={t.Name} className="flex items-center justify-between text-xs">
                  <span className="text-slate-700 dark:text-slate-300 font-medium">#{t.Name}</span>
                  <span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-sky-600 dark:text-sky-400 font-mono font-semibold">
                    {t.count} notes
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
