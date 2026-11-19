'use client';

import React, { useLayoutEffect, useRef, useState } from 'react';
import {
  clampSelectionRange,
  getLineAndColumnFromOffset,
  mapRawMarkdownOffsetToVisible,
  type PresenceField
} from '@/lib/presenceHelper';
import type { CollaboratorPresence } from '@/lib/realtimeShared';

interface MeasuredCaretGeometry {
  sessionId: string;
  userName: string;
  color: string;
  caretLeft: number;
  caretTop: number;
  caretHeight: number;
  selectionRects: Array<{ left: number; top: number; width: number; height: number }>;
}

let sharedTextareaMirrorEl: HTMLDivElement | null = null;

function getSharedMirrorElement(): HTMLDivElement {
  if (!sharedTextareaMirrorEl || !sharedTextareaMirrorEl.isConnected) {
    sharedTextareaMirrorEl = document.createElement('div');
    sharedTextareaMirrorEl.setAttribute('aria-hidden', 'true');
    sharedTextareaMirrorEl.style.position = 'fixed';
    sharedTextareaMirrorEl.style.left = '-99999px';
    sharedTextareaMirrorEl.style.top = '0px';
    sharedTextareaMirrorEl.style.visibility = 'hidden';
    sharedTextareaMirrorEl.style.pointerEvents = 'none';
    sharedTextareaMirrorEl.style.margin = '0px';
    sharedTextareaMirrorEl.style.overflow = 'hidden';
    document.body.appendChild(sharedTextareaMirrorEl);
  }
  return sharedTextareaMirrorEl;
}

function measureInputOrTextareaGeometry(
  hostEl: HTMLInputElement | HTMLTextAreaElement,
  originRect: DOMRect,
  rawStart: number,
  rawEnd: number
): Omit<MeasuredCaretGeometry, 'sessionId' | 'userName' | 'color'> | null {
  const value = hostEl.value || '';
  const { start, end } = clampSelectionRange(value.length, rawStart, rawEnd);
  const style = window.getComputedStyle(hostEl);
  const hostRect = hostEl.getBoundingClientRect();
  if (hostRect.width <= 0 || hostRect.height <= 0) return null;

  const mirror = getSharedMirrorElement();
  const isSingleLineInput = hostEl instanceof HTMLInputElement;
  const borderLeft = parseFloat(style.borderLeftWidth || '0') || 0;
  const borderRight = parseFloat(style.borderRightWidth || '0') || 0;

  mirror.style.boxSizing = 'border-box';
  mirror.style.width = isSingleLineInput
    ? `${Math.max(hostEl.clientWidth + borderLeft + borderRight, hostEl.scrollWidth + borderLeft + borderRight)}px`
    : `${hostEl.clientWidth + borderLeft + borderRight}px`;
  mirror.style.height = 'auto';
  mirror.style.whiteSpace = isSingleLineInput ? 'pre' : 'pre-wrap';
  mirror.style.wordBreak = isSingleLineInput ? 'normal' : style.wordBreak || 'break-word';
  mirror.style.overflowWrap = isSingleLineInput ? 'normal' : 'break-word';
  mirror.style.fontFamily = style.fontFamily;
  mirror.style.fontSize = style.fontSize;
  mirror.style.fontWeight = style.fontWeight;
  mirror.style.fontStyle = style.fontStyle;
  mirror.style.fontVariant = style.fontVariant;
  mirror.style.letterSpacing = style.letterSpacing;
  mirror.style.wordSpacing = style.wordSpacing;
  mirror.style.textTransform = style.textTransform;
  mirror.style.textIndent = style.textIndent;
  mirror.style.textAlign = style.textAlign;
  mirror.style.lineHeight = style.lineHeight;
  mirror.style.paddingTop = style.paddingTop;
  mirror.style.paddingRight = style.paddingRight;
  mirror.style.paddingBottom = style.paddingBottom;
  mirror.style.paddingLeft = style.paddingLeft;
  mirror.style.borderTopStyle = style.borderTopStyle;
  mirror.style.borderTopWidth = style.borderTopWidth;
  mirror.style.borderRightStyle = style.borderRightStyle;
  mirror.style.borderRightWidth = style.borderRightWidth;
  mirror.style.borderBottomStyle = style.borderBottomStyle;
  mirror.style.borderBottomWidth = style.borderBottomWidth;
  mirror.style.borderLeftStyle = style.borderLeftStyle;
  mirror.style.borderLeftWidth = style.borderLeftWidth;

  mirror.textContent = '';
  const beforeNode = document.createTextNode(value.slice(0, start));
  const caretProbe = document.createElement('span');
  caretProbe.textContent = '\u200b';
  mirror.appendChild(beforeNode);
  mirror.appendChild(caretProbe);

  if (end > start) {
    const selSpan = document.createElement('span');
    selSpan.textContent = value.slice(start, end);
    const afterNode = document.createTextNode(value.slice(end));
    mirror.appendChild(selSpan);
    mirror.appendChild(afterNode);

    const mirrorRect = mirror.getBoundingClientRect();
    const probeRect = caretProbe.getBoundingClientRect();
    const fallbackHeight = Math.max(
      14,
      Math.round(probeRect.height || parseFloat(style.fontSize || '16') * 1.25)
    );

    const caretLeft = Math.max(
      hostRect.left - originRect.left + 1,
      Math.min(
        hostRect.right - originRect.left - 2,
        hostRect.left - originRect.left + (probeRect.left - mirrorRect.left) - hostEl.scrollLeft
      )
    );
    const caretTop = Math.max(
      hostRect.top - originRect.top,
      Math.min(
        hostRect.bottom - originRect.top - fallbackHeight,
        hostRect.top - originRect.top + (probeRect.top - mirrorRect.top) - hostEl.scrollTop
      )
    );

    const selectionRects: MeasuredCaretGeometry['selectionRects'] = [];
    for (const r of Array.from(selSpan.getClientRects())) {
      if (r.width <= 0.5 && r.height <= 0.5) continue;
      const rawLeft = hostRect.left - originRect.left + (r.left - mirrorRect.left) - hostEl.scrollLeft;
      const rawRight = rawLeft + r.width;
      const clippedLeft = Math.max(hostRect.left - originRect.left, rawLeft);
      const clippedRight = Math.min(hostRect.right - originRect.left, rawRight);
      if (clippedRight <= clippedLeft) continue;
      selectionRects.push({
        left: clippedLeft,
        top: hostRect.top - originRect.top + (r.top - mirrorRect.top) - hostEl.scrollTop,
        width: clippedRight - clippedLeft,
        height: Math.max(fallbackHeight, r.height)
      });
    }

    return { caretLeft, caretTop, caretHeight: fallbackHeight, selectionRects };
  }

  const afterNode = document.createTextNode(value.slice(start));
  mirror.appendChild(afterNode);

  const mirrorRect = mirror.getBoundingClientRect();
  const probeRect = caretProbe.getBoundingClientRect();
  const fallbackHeight = Math.max(
    14,
    Math.round(probeRect.height || parseFloat(style.fontSize || '16') * 1.25)
  );

  const caretLeft = Math.max(
    hostRect.left - originRect.left + 1,
    Math.min(
      hostRect.right - originRect.left - 2,
      hostRect.left - originRect.left + (probeRect.left - mirrorRect.left) - hostEl.scrollLeft
    )
  );
  const caretTop = Math.max(
    hostRect.top - originRect.top,
    Math.min(
      hostRect.bottom - originRect.top - fallbackHeight,
      hostRect.top - originRect.top + (probeRect.top - mirrorRect.top) - hostEl.scrollTop
    )
  );

  return { caretLeft, caretTop, caretHeight: fallbackHeight, selectionRects: [] };
}

function collectVisibleTextNodes(root: HTMLElement): Array<{ node: Text; start: number; end: number }> {
  const result: Array<{ node: Text; start: number; end: number }> = [];
  let cursor = 0;

  const walk = (el: Node) => {
    if (el.nodeType === Node.TEXT_NODE) {
      const textNode = el as Text;
      const len = textNode.nodeValue?.length || 0;
      if (len > 0) {
        result.push({ node: textNode, start: cursor, end: cursor + len });
        cursor += len;
      }
      return;
    }
    if (el.nodeType !== Node.ELEMENT_NODE) return;
    const elem = el as HTMLElement;
    if (elem.classList?.contains('katex-mathml') || elem.getAttribute('aria-hidden') === 'true') {
      return;
    }
    for (const child of Array.from(elem.childNodes)) {
      walk(child);
    }
  };

  walk(root);
  return result;
}

function locateTextPoint(
  segments: Array<{ node: Text; start: number; end: number }>,
  visibleOffset: number
): { node: Text; offset: number } | null {
  if (segments.length === 0) return null;
  for (const seg of segments) {
    if (visibleOffset <= seg.end) {
      return {
        node: seg.node,
        offset: Math.max(0, Math.min(seg.end - seg.start, visibleOffset - seg.start))
      };
    }
  }
  const last = segments[segments.length - 1];
  return { node: last.node, offset: last.end - last.start };
}

function measurePreviewElementGeometry(
  hostEl: HTMLElement,
  rawText: string,
  originRect: DOMRect,
  rawStart: number,
  rawEnd: number
): Omit<MeasuredCaretGeometry, 'sessionId' | 'userName' | 'color'> | null {
  const hostRect = hostEl.getBoundingClientRect();
  if (hostRect.width <= 0 || hostRect.height <= 0) return null;

  const style = window.getComputedStyle(hostEl);
  const paddingLeft = parseFloat(style.paddingLeft || '0') || 0;
  const paddingTop = parseFloat(style.paddingTop || '0') || 0;
  const fontSize = parseFloat(style.fontSize || '16') || 16;
  const fallbackHeight = Math.max(14, Math.round(parseFloat(style.lineHeight) || fontSize * 1.35));

  const { start, end } = clampSelectionRange(rawText.length, rawStart, rawEnd);
  const visStart = mapRawMarkdownOffsetToVisible(rawText, start);
  const visEnd = Math.max(visStart, mapRawMarkdownOffsetToVisible(rawText, end));

  const segments = collectVisibleTextNodes(hostEl);
  if (segments.length === 0) {
    return {
      caretLeft: hostRect.left - originRect.left + paddingLeft,
      caretTop: hostRect.top - originRect.top + paddingTop,
      caretHeight: fallbackHeight,
      selectionRects: []
    };
  }

  const totalVisibleLen = segments[segments.length - 1]?.end || 0;
  const clampedVisStart = Math.max(0, Math.min(totalVisibleLen, visStart));
  const clampedVisEnd = Math.max(clampedVisStart, Math.min(totalVisibleLen, visEnd));

  const startPoint = locateTextPoint(segments, clampedVisStart);
  if (!startPoint) return null;

  const caretRange = document.createRange();
  caretRange.setStart(startPoint.node, startPoint.offset);
  caretRange.setEnd(startPoint.node, startPoint.offset);

  let caretRect = Array.from(caretRange.getClientRects())[0];
  let caretLeft: number | null = null;
  let caretTop: number | null = null;
  let caretHeight = fallbackHeight;

  if (caretRect && caretRect.height > 0) {
    caretLeft = caretRect.left - originRect.left;
    caretTop = caretRect.top - originRect.top;
    caretHeight = Math.max(14, Math.round(caretRect.height));
  } else if (startPoint.offset > 0) {
    const prevRange = document.createRange();
    prevRange.setStart(startPoint.node, startPoint.offset - 1);
    prevRange.setEnd(startPoint.node, startPoint.offset);
    const prevRect = Array.from(prevRange.getClientRects()).pop();
    if (prevRect && prevRect.height > 0) {
      caretLeft = prevRect.right - originRect.left;
      caretTop = prevRect.top - originRect.top;
      caretHeight = Math.max(14, Math.round(prevRect.height));
    }
  } else if ((startPoint.node.nodeValue?.length || 0) > 0) {
    const nextRange = document.createRange();
    nextRange.setStart(startPoint.node, 0);
    nextRange.setEnd(startPoint.node, 1);
    caretRect = Array.from(nextRange.getClientRects())[0];
    if (caretRect && caretRect.height > 0) {
      caretLeft = caretRect.left - originRect.left;
      caretTop = caretRect.top - originRect.top;
      caretHeight = Math.max(14, Math.round(caretRect.height));
    }
  }

  if (caretLeft === null || caretTop === null) {
    caretLeft = hostRect.left - originRect.left + paddingLeft;
    caretTop = hostRect.top - originRect.top + paddingTop;
  }

  caretLeft = Math.max(
    hostRect.left - originRect.left + 1,
    Math.min(hostRect.right - originRect.left - 2, caretLeft)
  );

  const selectionRects: MeasuredCaretGeometry['selectionRects'] = [];
  if (clampedVisEnd > clampedVisStart) {
    const endPoint = locateTextPoint(segments, clampedVisEnd);
    if (endPoint) {
      const selRange = document.createRange();
      selRange.setStart(startPoint.node, startPoint.offset);
      selRange.setEnd(endPoint.node, endPoint.offset);
      for (const r of Array.from(selRange.getClientRects())) {
        if (r.width <= 0.5 && r.height <= 0.5) continue;
        selectionRects.push({
          left: r.left - originRect.left,
          top: r.top - originRect.top,
          width: r.width,
          height: Math.max(fallbackHeight, r.height)
        });
      }
    }
  }

  return { caretLeft, caretTop, caretHeight, selectionRects };
}

function areGeometriesEqual(
  prev: readonly MeasuredCaretGeometry[],
  next: readonly MeasuredCaretGeometry[]
): boolean {
  if (prev.length !== next.length) return false;
  for (let i = 0; i < prev.length; i += 1) {
    const a = prev[i];
    const b = next[i];
    if (
      a.sessionId !== b.sessionId ||
      a.userName !== b.userName ||
      a.color !== b.color ||
      Math.abs(a.caretLeft - b.caretLeft) > 0.5 ||
      Math.abs(a.caretTop - b.caretTop) > 0.5 ||
      Math.abs(a.caretHeight - b.caretHeight) > 0.5 ||
      a.selectionRects.length !== b.selectionRects.length
    ) {
      return false;
    }
    for (let j = 0; j < a.selectionRects.length; j += 1) {
      const ra = a.selectionRects[j];
      const rb = b.selectionRects[j];
      if (
        Math.abs(ra.left - rb.left) > 0.5 ||
        Math.abs(ra.top - rb.top) > 0.5 ||
        Math.abs(ra.width - rb.width) > 0.5 ||
        Math.abs(ra.height - rb.height) > 0.5
      ) {
        return false;
      }
    }
  }
  return true;
}

export const CollaboratorCaretOverlay: React.FC<{
  hostRefs: React.RefObject<Record<string, HTMLElement | null>>;
  hostKey: string;
  layoutKey: string;
  text: string;
  field: PresenceField;
  collaborators: readonly CollaboratorPresence[];
}> = ({ hostRefs, hostKey, layoutKey, text, field, collaborators }) => {
  const overlayRef = useRef<HTMLDivElement | null>(null);
  const [geometries, setGeometries] = useState<MeasuredCaretGeometry[]>([]);

  const relevant = React.useMemo(
    () => collaborators.filter((c) => c.field === field),
    [collaborators, field]
  );
  const relevantSignature = React.useMemo(
    () =>
      relevant
        .map(
          (c) =>
            `${c.sessionId}:${c.selectionStart}:${c.selectionEnd}:${c.userName}:${c.color}`
        )
        .join('|'),
    [relevant]
  );

  useLayoutEffect(() => {
    if (relevant.length === 0) {
      setGeometries((prev) => (prev.length === 0 ? prev : []));
      return;
    }

    const measureAll = () => {
      const overlayEl = overlayRef.current;
      const hostEl = hostRefs.current?.[hostKey] ?? null;
      if (!overlayEl || !hostEl || !hostEl.isConnected) {
        setGeometries((prev) => (prev.length === 0 ? prev : []));
        return;
      }

      const originRect = overlayEl.getBoundingClientRect();
      if (originRect.width <= 0 || originRect.height <= 0) return;

      const next: MeasuredCaretGeometry[] = [];
      for (const c of relevant) {
        const geom =
          hostEl instanceof HTMLInputElement || hostEl instanceof HTMLTextAreaElement
            ? measureInputOrTextareaGeometry(hostEl, originRect, c.selectionStart, c.selectionEnd)
            : measurePreviewElementGeometry(hostEl, text, originRect, c.selectionStart, c.selectionEnd);

        if (geom) {
          next.push({
            sessionId: c.sessionId,
            userName: c.userName,
            color: c.color,
            ...geom
          });
        }
      }
      setGeometries((prev) => (areGeometriesEqual(prev, next) ? prev : next));
    };

    measureAll();

    const hostEl = hostRefs.current?.[hostKey] ?? null;
    let resizeObs: ResizeObserver | null = null;
    if (hostEl && typeof ResizeObserver !== 'undefined') {
      resizeObs = new ResizeObserver(() => measureAll());
      resizeObs.observe(hostEl);
    }

    const handleScroll = () => measureAll();
    if (hostEl) {
      hostEl.addEventListener('scroll', handleScroll, { passive: true });
    }
    window.addEventListener('resize', handleScroll, { passive: true });

    return () => {
      resizeObs?.disconnect();
      if (hostEl) {
        hostEl.removeEventListener('scroll', handleScroll);
      }
      window.removeEventListener('resize', handleScroll);
    };
  }, [hostRefs, hostKey, layoutKey, text, field, relevant, relevantSignature]);

  if (relevant.length === 0) return null;

  return (
    <div
      ref={overlayRef}
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 overflow-visible select-none z-20 no-print"
    >
      {geometries.map((g, idx) => {
        const stackOffset = (idx % 3) * 14;
        const badgeTop =
          g.caretTop < 14 ? g.caretHeight + 2 + stackOffset : -15 - stackOffset;
        return (
          <React.Fragment key={g.sessionId}>
            {g.selectionRects.map((sr, sIdx) => (
              <span
                key={`${g.sessionId}-sel-${sIdx}`}
                className="absolute rounded-[3px] transition-all duration-75"
                style={{
                  left: `${sr.left}px`,
                  top: `${sr.top}px`,
                  width: `${sr.width}px`,
                  height: `${sr.height}px`,
                  backgroundColor: `${g.color}2E`
                }}
              />
            ))}

            <span
              className="miu-remote-caret-line absolute w-[2px] rounded-full transition-all duration-75"
              style={{
                left: `${g.caretLeft}px`,
                top: `${g.caretTop}px`,
                height: `${g.caretHeight}px`,
                backgroundColor: g.color,
                boxShadow: `0 0 8px ${g.color}88`
              }}
            >
              <span
                className="absolute left-0 px-1.5 py-[1px] rounded-t-md rounded-br-md text-[9.5px] leading-tight font-bold text-white shadow-sm whitespace-nowrap"
                style={{
                  top: `${badgeTop}px`,
                  backgroundColor: g.color
                }}
              >
                {g.userName.split(' ')[0]}
              </span>
            </span>
          </React.Fragment>
        );
      })}
    </div>
  );
};

export const BlockCollaboratorBadges: React.FC<{
  collaborators: readonly CollaboratorPresence[];
  contentText: string;
  toggleBodyText?: string;
  compact?: boolean;
}> = ({ collaborators, contentText, toggleBodyText = '', compact = false }) => {
  if (collaborators.length === 0) return null;

  return (
    <div
      aria-hidden="true"
      className={`pointer-events-none select-none absolute ${
        compact ? 'right-1 -top-2.5' : 'right-2 -top-2.5'
      } z-20 flex items-center gap-1 flex-wrap justify-end max-w-[75%] no-print`}
    >
      {collaborators.map((c) => {
        const refText =
          c.field === 'toggleBody' ? toggleBodyText : contentText;
        const { start, end } = clampSelectionRange(
          refText.length,
          c.selectionStart,
          c.selectionEnd
        );
        const pos = getLineAndColumnFromOffset(refText, start);
        const cursorDetail =
          end > start
            ? `Sorot ${end - start} kar`
            : c.isEditing
              ? refText.length > 0 || pos.line > 1
                ? `Mengetik · ${pos.line}:${pos.column}`
                : 'Mengetik'
              : c.field === 'toggleBody'
                ? 'Di isi Toggle'
                : 'Di blok ini';

        return (
          <span
            key={c.sessionId}
            className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9.5px] font-semibold text-white shadow-md backdrop-blur-sm"
            style={{ backgroundColor: c.color }}
          >
            {c.userPicture ? (
              <img
                src={c.userPicture}
                alt={c.userName}
                className="w-3.5 h-3.5 rounded-full object-cover border border-white/60 shrink-0"
              />
            ) : (
              <span className="w-3.5 h-3.5 rounded-full bg-white/25 text-[8px] font-bold flex items-center justify-center shrink-0">
                {c.userName.slice(0, 1).toUpperCase()}
              </span>
            )}
            <span className="max-w-[82px] truncate">{c.userName.split(' ')[0]}</span>
            <span className="opacity-85 font-mono text-[8.5px] hidden sm:inline">
              · {cursorDetail}
            </span>
          </span>
        );
      })}
    </div>
  );
};

export const BlockCollaboratorPointers: React.FC<{
  pointers: readonly CollaboratorPresence[];
}> = ({ pointers }) => {
  if (pointers.length === 0) return null;

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none select-none absolute inset-0 overflow-visible z-20 no-print"
    >
      {pointers.map((c) => {
        if (c.pointerX === null || c.pointerY === null) return null;
        return (
          <div
            key={`ptr-${c.sessionId}`}
            className="absolute transition-all duration-200 ease-out"
            style={{
              left: `${c.pointerX * 100}%`,
              top: `${c.pointerY * 100}%`,
              transform: 'translate(-2px, -2px)'
            }}
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 18 18"
              fill="none"
              className="drop-shadow-md"
            >
              <path
                d="M2.5 2L15 8.5L9.2 10.2L7 15.8L2.5 2Z"
                fill={c.color}
                stroke="#FFFFFF"
                strokeWidth="1.5"
                strokeLinejoin="round"
              />
            </svg>
            <span
              className="ml-2.5 -mt-1 inline-block px-1.5 py-[1px] rounded-md text-[9.5px] font-bold text-white shadow-md whitespace-nowrap"
              style={{ backgroundColor: c.color }}
            >
              {c.userName.split(' ')[0]}
            </span>
          </div>
        );
      })}
    </div>
  );
};

export const CollaboratorsHeaderStrip: React.FC<{
  collaborators: readonly CollaboratorPresence[];
  onJumpToCollaborator: (collab: CollaboratorPresence) => void;
}> = ({ collaborators, onJumpToCollaborator }) => {
  if (collaborators.length === 0) return null;

  return (
    <div
      className="flex items-center gap-1 pr-1 mr-0.5 border-r border-border-subtle/70"
      title="Klik avatar kolaborator untuk melompat ke blok mereka"
    >
      {collaborators.slice(0, 4).map((c) => {
        const whereLabel =
          c.blockId === '__title__'
            ? 'Judul Catatan'
            : c.blockId
              ? c.isEditing
                ? 'Sedang mengetik'
                : 'Di dalam blok'
              : 'Melihat halaman';

        return (
          <button
            key={c.sessionId}
            type="button"
            onClick={() => onJumpToCollaborator(c)}
            className="inline-flex items-center gap-1.5 pl-1 pr-2 py-0.5 rounded-full border text-[11px] font-semibold text-text-primary hover:opacity-90 transition shadow-sm shrink-0"
            style={{
              backgroundColor: `${c.color}18`,
              borderColor: `${c.color}55`
            }}
            title={`${c.userName} (${whereLabel}) — Klik untuk ke posisi bloknya`}
          >
            <span className="relative flex items-center justify-center shrink-0">
              {c.userPicture ? (
                <img
                  src={c.userPicture}
                  alt={c.userName}
                  className="w-4 h-4 rounded-full object-cover"
                />
              ) : (
                <span
                  className="w-4 h-4 rounded-full text-[9px] font-bold text-white flex items-center justify-center"
                  style={{ backgroundColor: c.color }}
                >
                  {c.userName.slice(0, 1).toUpperCase()}
                </span>
              )}
              <span
                className="absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full border border-surface"
                style={{ backgroundColor: c.isEditing ? '#10B981' : c.color }}
              />
            </span>
            <span className="hidden lg:inline max-w-[80px] truncate">
              {c.userName.split(' ')[0]}
            </span>
          </button>
        );
      })}
      {collaborators.length > 4 && (
        <span className="px-1.5 py-0.5 rounded-full bg-subtle border border-border-subtle text-[10px] font-mono font-bold text-text-secondary">
          +{collaborators.length - 4}
        </span>
      )}
    </div>
  );
};
