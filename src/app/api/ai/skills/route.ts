import { NextRequest, NextResponse } from 'next/server';
import {
  executeServerNeonQuery,
  isServerNeonConfigured
} from '@/lib/serverCloud';
import {
  OFFICIAL_SKILL_LIBRARY,
  SKILL_LIBRARY_CATEGORIES,
  type SkillLibraryCategory,
  type SkillLibraryItem
} from '@/utils/skillLibraryCatalog';

export const dynamic = 'force-dynamic';

let skillTableInitialized = false;

async function ensureSkillLibraryTable(): Promise<boolean> {
  if (!isServerNeonConfigured()) return false;
  if (skillTableInitialized) return true;
  try {
    await executeServerNeonQuery(`
      CREATE TABLE IF NOT EXISTS miu_skill_library (
        id TEXT PRIMARY KEY,
        slug TEXT NOT NULL,
        name TEXT NOT NULL,
        icon TEXT NOT NULL DEFAULT '🧩',
        category TEXT NOT NULL DEFAULT 'Komunitas',
        summary TEXT NOT NULL DEFAULT '',
        function_description TEXT NOT NULL DEFAULT '',
        use_cases JSONB NOT NULL DEFAULT '[]'::jsonb,
        tags JSONB NOT NULL DEFAULT '[]'::jsonb,
        connection_url TEXT NOT NULL DEFAULT '',
        instructions_markdown TEXT NOT NULL DEFAULT '',
        author_name TEXT NOT NULL DEFAULT 'Pengguna Miu',
        author_id TEXT NOT NULL DEFAULT '',
        install_count INTEGER NOT NULL DEFAULT 1,
        created_at BIGINT NOT NULL,
        updated_at BIGINT NOT NULL
      );
    `);
    skillTableInitialized = true;
    return true;
  } catch (err) {
    console.warn('[API /ai/skills] Failed to init miu_skill_library table:', err);
    return false;
  }
}

interface NeonSkillRow {
  id: string;
  slug: string;
  name: string;
  icon: string | null;
  category: string | null;
  summary: string | null;
  function_description: string | null;
  use_cases: unknown;
  tags: unknown;
  connection_url: string | null;
  instructions_markdown: string | null;
  author_name: string | null;
  author_id: string | null;
  install_count: number | string | null;
  created_at: number | string | null;
  updated_at: number | string | null;
}

function parseJsonStringArray(raw: unknown): string[] {
  if (Array.isArray(raw)) {
    return raw.filter((x): x is string => typeof x === 'string' && Boolean(x.trim()));
  }
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed.filter(
          (x): x is string => typeof x === 'string' && Boolean(x.trim())
        );
      }
    } catch {
      // ignore
    }
  }
  return [];
}

function normalizeCategory(raw: unknown): SkillLibraryCategory {
  const str = typeof raw === 'string' ? raw.trim() : '';
  if (SKILL_LIBRARY_CATEGORIES.includes(str as SkillLibraryCategory)) {
    return str as SkillLibraryCategory;
  }
  return 'Komunitas';
}

function mapRowToSkillItem(row: NeonSkillRow): SkillLibraryItem {
  const now = Date.now();
  return {
    id: row.id,
    slug: row.slug || 'skill.md',
    name: row.name || 'Skill Komunitas',
    icon: row.icon || '🧩',
    category: normalizeCategory(row.category),
    summary: row.summary || '',
    functionDescription: row.function_description || row.summary || '',
    useCases: parseJsonStringArray(row.use_cases),
    tags: parseJsonStringArray(row.tags),
    connectionUrl: row.connection_url || undefined,
    instructionsMarkdown: row.instructions_markdown || '',
    authorName: row.author_name || 'Pengguna Miu',
    authorId: row.author_id || undefined,
    isOfficial: false,
    installCount: Math.max(1, Number(row.install_count) || 1),
    createdAt: Number(row.created_at) || now,
    updatedAt: Number(row.updated_at) || now
  };
}

export async function GET() {
  const hasNeon = await ensureSkillLibraryTable();
  const communitySkills: SkillLibraryItem[] = [];

  if (hasNeon) {
    try {
      const res = await executeServerNeonQuery<NeonSkillRow>(`
        SELECT * FROM miu_skill_library
        ORDER BY install_count DESC, updated_at DESC
        LIMIT 80
      `);
      for (const row of res.rows) {
        communitySkills.push(mapRowToSkillItem(row));
      }
    } catch (err) {
      console.warn('[API /ai/skills GET] Query failed:', err);
    }
  }

  return NextResponse.json(
    {
      ok: true,
      cloudSynced: hasNeon,
      skills: [...OFFICIAL_SKILL_LIBRARY, ...communitySkills]
    },
    { headers: { 'Cache-Control': 'no-store' } }
  );
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      action?: 'publish' | 'install' | 'delete';
      id?: string;
      slug?: string;
      name?: string;
      icon?: string;
      category?: string;
      summary?: string;
      functionDescription?: string;
      useCases?: string[];
      tags?: string[];
      connectionUrl?: string;
      instructionsMarkdown?: string;
      authorName?: string;
      authorId?: string;
    };

    const action = body.action || 'publish';
    const hasNeon = await ensureSkillLibraryTable();

    if (action === 'install') {
      const targetId = String(body.id || '').trim();
      if (!targetId) {
        return NextResponse.json(
          { ok: false, error: 'ID skill tidak valid.' },
          { status: 400 }
        );
      }
      if (hasNeon && !targetId.startsWith('skill-lib-')) {
        await executeServerNeonQuery(
          `UPDATE miu_skill_library SET install_count = install_count + 1 WHERE id = $1`,
          [targetId]
        ).catch(() => {});
      }
      return NextResponse.json({ ok: true, id: targetId });
    }

    if (action === 'delete') {
      const targetId = String(body.id || '').trim();
      const authorId = String(body.authorId || '').trim();
      if (!targetId) {
        return NextResponse.json(
          { ok: false, error: 'ID skill tidak valid.' },
          { status: 400 }
        );
      }
      if (hasNeon) {
        if (authorId) {
          await executeServerNeonQuery(
            `DELETE FROM miu_skill_library WHERE id = $1 AND (author_id = $2 OR author_id = '')`,
            [targetId, authorId]
          );
        } else {
          await executeServerNeonQuery(
            `DELETE FROM miu_skill_library WHERE id = $1`,
            [targetId]
          );
        }
      }
      return NextResponse.json({ ok: true, deletedId: targetId });
    }

    // action === 'publish'
    const name = String(body.name || '').trim();
    const functionDescription = String(body.functionDescription || body.summary || '').trim();
    const instructionsMarkdown = String(body.instructionsMarkdown || '').trim();

    if (!name) {
      return NextResponse.json(
        { ok: false, error: 'Nama skill wajib diisi.' },
        { status: 400 }
      );
    }
    if (!functionDescription) {
      return NextResponse.json(
        {
          ok: false,
          error: 'Penjelasan fungsi skill (fungsinya apa & kegunaannya) wajib diisi.'
        },
        { status: 400 }
      );
    }

    const now = Date.now();
    const cleanSlugRaw = String(
      body.slug || `${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}/skill.md`
    ).trim();
    const slug = cleanSlugRaw.toLowerCase().includes('skill.md')
      ? cleanSlugRaw
      : `${cleanSlugRaw}/skill.md`;

    const id =
      typeof body.id === 'string' && body.id.trim()
        ? body.id.trim()
        : `skill-comm-${now}-${Math.random().toString(36).slice(2, 6)}`;
    const icon = String(body.icon || '🧩').trim() || '🧩';
    const category = normalizeCategory(body.category);
    const summary =
      String(body.summary || '').trim() ||
      functionDescription.split('\n')[0].slice(0, 150);
    const useCases = Array.isArray(body.useCases)
      ? body.useCases.map((u) => String(u).trim()).filter(Boolean).slice(0, 8)
      : [];
    const tags = Array.isArray(body.tags)
      ? body.tags.map((t) => String(t).trim()).filter(Boolean).slice(0, 8)
      : ['Skill Komunitas'];
    const connectionUrl = String(body.connectionUrl || '').trim();
    const authorName = String(body.authorName || 'Pengguna Miu').trim() || 'Pengguna Miu';
    const authorId = String(body.authorId || '').trim();

    const finalInstructions =
      instructionsMarkdown ||
      `## Fungsi & Peran Skill: ${name}\n${functionDescription}\n\n## Kegunaan Utama\n${useCases
        .map((u) => `- ${u}`)
        .join('\n')}`;

    const publishedItem: SkillLibraryItem = {
      id,
      slug,
      name,
      icon,
      category,
      summary,
      functionDescription,
      useCases,
      tags,
      connectionUrl: connectionUrl || undefined,
      instructionsMarkdown: finalInstructions,
      authorName,
      authorId: authorId || undefined,
      isOfficial: false,
      installCount: 1,
      createdAt: now,
      updatedAt: now
    };

    if (hasNeon) {
      await executeServerNeonQuery(
        `
        INSERT INTO miu_skill_library (
          id, slug, name, icon, category, summary, function_description,
          use_cases, tags, connection_url, instructions_markdown,
          author_name, author_id, install_count, created_at, updated_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7,
          $8::jsonb, $9::jsonb, $10, $11,
          $12, $13, 1, $14, $15
        )
        ON CONFLICT (id) DO UPDATE SET
          slug = EXCLUDED.slug,
          name = EXCLUDED.name,
          icon = EXCLUDED.icon,
          category = EXCLUDED.category,
          summary = EXCLUDED.summary,
          function_description = EXCLUDED.function_description,
          use_cases = EXCLUDED.use_cases,
          tags = EXCLUDED.tags,
          connection_url = EXCLUDED.connection_url,
          instructions_markdown = EXCLUDED.instructions_markdown,
          author_name = EXCLUDED.author_name,
          updated_at = EXCLUDED.updated_at;
        `,
        [
          id,
          slug,
          name,
          icon,
          category,
          summary,
          functionDescription,
          JSON.stringify(useCases),
          JSON.stringify(tags),
          connectionUrl,
          finalInstructions,
          authorName,
          authorId,
          now,
          now
        ]
      );
    }

    return NextResponse.json({
      ok: true,
      cloudSynced: hasNeon,
      skill: publishedItem
    });
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        error:
          err instanceof Error
            ? err.message
            : 'Gagal memproses permintaan Pustaka Skill.'
      },
      { status: 500 }
    );
  }
}
