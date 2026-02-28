import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateBlog1772000000000 implements MigrationInterface {
  name = 'CreateBlog1772000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create Tables
    await queryRunner.query(`
      CREATE TYPE "public"."blog_posts_status_enum" AS ENUM('draft', 'published', 'archived');
      
      CREATE TABLE "blog_posts" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "title" character varying(255) NOT NULL,
        "slug" character varying(255) NOT NULL,
        "description" text,
        "content" jsonb,
        "cover_image_url" text,
        "category" character varying(100),
        "read_time" character varying(50),
        "keywords" text array,
        "status" "public"."blog_posts_status_enum" NOT NULL DEFAULT 'draft',
        "meta_title" character varying(255),
        "views" integer NOT NULL DEFAULT 0,
        "likes_count" integer NOT NULL DEFAULT 0,
        "published_at" TIMESTAMP,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_blog_posts_slug" UNIQUE ("slug"),
        CONSTRAINT "PK_blog_posts" PRIMARY KEY ("id")
      );

      CREATE TABLE "blog_comments" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "post_id" uuid NOT NULL,
        "author_name" character varying(100) NOT NULL,
        "author_email" character varying(255) NOT NULL,
        "content" text NOT NULL,
        "is_approved" boolean NOT NULL DEFAULT false,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_blog_comments" PRIMARY KEY ("id")
      );

      CREATE TABLE "blog_likes" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "post_id" uuid NOT NULL,
        "ip_address" character varying(64) NOT NULL,
        CONSTRAINT "UQ_blog_likes_post_id_ip_address" UNIQUE ("post_id", "ip_address"),
        CONSTRAINT "PK_blog_likes" PRIMARY KEY ("id")
      );

      CREATE TABLE "blog_admin_notes" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "post_id" uuid NOT NULL,
        "admin_id" uuid NOT NULL,
        "note" text NOT NULL,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_blog_admin_notes" PRIMARY KEY ("id")
      );

      ALTER TABLE "blog_comments" ADD CONSTRAINT "FK_blog_comments_post_id" FOREIGN KEY ("post_id") REFERENCES "blog_posts"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
      ALTER TABLE "blog_likes" ADD CONSTRAINT "FK_blog_likes_post_id" FOREIGN KEY ("post_id") REFERENCES "blog_posts"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
      ALTER TABLE "blog_admin_notes" ADD CONSTRAINT "FK_blog_admin_notes_post_id" FOREIGN KEY ("post_id") REFERENCES "blog_posts"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
    `);

    // Insert hardcoded post inside table
    const postContent = {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            {
              type: 'text',
              text: 'Faceless video channels are one of the fastest-growing niches on the internet in 2026. Creators are building audiences of hundreds of thousands — without ever showing their face, speaking into a microphone, or touching a video editor. The secret? AI.',
            },
          ],
        },
        {
          type: 'paragraph',
          content: [
            {
              type: 'text',
              text: 'This guide walks you through everything you need to know to start a faceless video channel using an AI video creator like AutoReels — from picking a niche to publishing your first reel in under 60 seconds.',
            },
          ],
        },
        {
          type: 'heading',
          attrs: { level: 2 },
          content: [
            {
              type: 'text',
              text: 'What Is a Faceless Video Channel?',
            },
          ],
        },
        {
          type: 'paragraph',
          content: [
            {
              type: 'text',
              text: 'A faceless channel is a social media account or YouTube channel where the creator never appears on camera. Instead of a talking head, videos use stock footage, AI-generated visuals, animated text, and AI voiceovers to deliver content.',
            },
          ],
        },
        {
          type: 'paragraph',
          content: [
            {
              type: 'text',
              text: 'Popular faceless niches include: motivational content, finance tips, history facts, tech news, true crime, language learning, and "did you know" style edutainment.',
            },
          ],
        },
        {
          type: 'heading',
          attrs: { level: 2 },
          content: [
            {
              type: 'text',
              text: 'Why Faceless Videos Work in 2026',
            },
          ],
        },
        {
          type: 'paragraph',
          content: [
            {
              type: 'text',
              text: 'Short-form video platforms — TikTok, Instagram Reels, and YouTube Shorts — reward consistency above all else. Algorithms push accounts that post daily or multiple times per day. For human creators, that pace is unsustainable. With an AI faceless video creator, you can generate 5–10 videos per day in the time it used to take to film one.',
            },
          ],
        },
        {
          type: 'heading',
          attrs: { level: 2 },
          content: [{ type: 'text', text: 'Step 1: Choose Your Niche' }],
        },
        {
          type: 'paragraph',
          content: [
            {
              type: 'text',
              text: 'Pick a niche with high engagement and broad appeal. Some of the best-performing faceless niches right now:',
            },
          ],
        },
        {
          type: 'bulletList',
          content: [
            {
              type: 'listItem',
              content: [
                {
                  type: 'paragraph',
                  content: [
                    { type: 'text', marks: [{ type: 'bold' }], text: 'Motivational quotes' },
                    { type: 'text', text: ' — evergreen, high share rate' },
                  ],
                },
              ],
            },
            {
              type: 'listItem',
              content: [
                {
                  type: 'paragraph',
                  content: [
                    { type: 'text', marks: [{ type: 'bold' }], text: 'Finance & investing tips' },
                    { type: 'text', text: ' — high CPM if monetized' },
                  ],
                },
              ],
            },
            {
              type: 'listItem',
              content: [
                {
                  type: 'paragraph',
                  content: [
                    { type: 'text', marks: [{ type: 'bold' }], text: 'AI & tech news' },
                    { type: 'text', text: ' — rapidly growing audience' },
                  ],
                },
              ],
            },
            {
              type: 'listItem',
              content: [
                {
                  type: 'paragraph',
                  content: [
                    { type: 'text', marks: [{ type: 'bold' }], text: 'History facts' },
                    { type: 'text', text: ' — extremely viral on TikTok' },
                  ],
                },
              ],
            },
            {
              type: 'listItem',
              content: [
                {
                  type: 'paragraph',
                  content: [
                    { type: 'text', marks: [{ type: 'bold' }], text: 'Life hacks' },
                    { type: 'text', text: ' — consistently high engagement' },
                  ],
                },
              ],
            },
          ],
        },
        {
          type: 'heading',
          attrs: { level: 2 },
          content: [{ type: 'text', text: 'Step 2: Set Up Your AI Video Creator' }],
        },
        {
          type: 'paragraph',
          content: [
            {
              type: 'text',
              text: 'Use AutoReels as your AI faceless video creator. Sign up for free — you get 10 starter credits. Each credit generates one complete video: AI-written script, AI voiceover, automatic captions, and synced background visuals.',
            },
          ],
        },
        {
          type: 'paragraph',
          content: [
            {
              type: 'text',
              text: 'No software to install. No editing timeline to learn. Just describe your video topic and the AI does the rest.',
            },
          ],
        },
        {
          type: 'heading',
          attrs: { level: 2 },
          content: [{ type: 'text', text: 'Step 3: Generate Your First Video' }],
        },
        {
          type: 'paragraph',
          content: [
            {
              type: 'text',
              text: 'Go to ',
            },
            { type: 'text', marks: [{ type: 'bold' }], text: 'Create' },
            {
              type: 'text',
              text: ' in your AutoReels dashboard. Enter a topic — for example: "5 habits of self-made millionaires". The AI will:',
            },
          ],
        },
        {
          type: 'bulletList',
          content: [
            {
              type: 'listItem',
              content: [
                {
                  type: 'paragraph',
                  content: [
                    {
                      type: 'text',
                      text: 'Write a punchy script optimized for short-form engagement',
                    },
                  ],
                },
              ],
            },
            {
              type: 'listItem',
              content: [
                {
                  type: 'paragraph',
                  content: [
                    {
                      type: 'text',
                      text: 'Generate a professional AI voiceover (50+ voice options)',
                    },
                  ],
                },
              ],
            },
            {
              type: 'listItem',
              content: [
                {
                  type: 'paragraph',
                  content: [
                    { type: 'text', text: 'Add animated captions synchronized to the audio' },
                  ],
                },
              ],
            },
            {
              type: 'listItem',
              content: [
                {
                  type: 'paragraph',
                  content: [
                    {
                      type: 'text',
                      text: 'Select cinematic stock footage or AI visuals matching your script',
                    },
                  ],
                },
              ],
            },
            {
              type: 'listItem',
              content: [
                {
                  type: 'paragraph',
                  content: [
                    {
                      type: 'text',
                      text: 'Render a 9:16 vertical video ready for TikTok, Reels, or Shorts',
                    },
                  ],
                },
              ],
            },
          ],
        },
        {
          type: 'paragraph',
          content: [{ type: 'text', text: 'The entire process takes 30–60 seconds.' }],
        },
        {
          type: 'heading',
          attrs: { level: 2 },
          content: [{ type: 'text', text: 'Step 4: Customize Your Style' }],
        },
        {
          type: 'paragraph',
          content: [
            {
              type: 'text',
              text: 'AutoReels offers 12+ visual styles — Cinematic, Minimal, Anime, Noir, Nature, and more. Pick a consistent style for your channel to build a recognizable brand aesthetic. Consistency in visual style is one of the most underrated growth levers on short-form platforms.',
            },
          ],
        },
        {
          type: 'heading',
          attrs: { level: 2 },
          content: [{ type: 'text', text: 'Step 5: Post Daily — Consistency Wins' }],
        },
        {
          type: 'paragraph',
          content: [
            {
              type: 'text',
              text: "The algorithm rewards volume. Aim for at least one video per day. With AutoReels, you can batch-create a week's worth of content in an hour, download everything, and post consistently without the daily grind.",
            },
          ],
        },
        {
          type: 'heading',
          attrs: { level: 2 },
          content: [{ type: 'text', text: 'Common Mistakes to Avoid' }],
        },
        {
          type: 'bulletList',
          content: [
            {
              type: 'listItem',
              content: [
                {
                  type: 'paragraph',
                  content: [
                    { type: 'text', marks: [{ type: 'bold' }], text: 'Inconsistent posting' },
                    { type: 'text', text: ' — algorithms punish gaps. Post every day.' },
                  ],
                },
              ],
            },
            {
              type: 'listItem',
              content: [
                {
                  type: 'paragraph',
                  content: [
                    { type: 'text', marks: [{ type: 'bold' }], text: 'Too many niches' },
                    { type: 'text', text: ' — pick one and dominate it before expanding.' },
                  ],
                },
              ],
            },
            {
              type: 'listItem',
              content: [
                {
                  type: 'paragraph',
                  content: [
                    { type: 'text', marks: [{ type: 'bold' }], text: 'Ignoring captions' },
                    {
                      type: 'text',
                      text: ' — 85% of social video is watched on mute. Captions are non-negotiable.',
                    },
                  ],
                },
              ],
            },
            {
              type: 'listItem',
              content: [
                {
                  type: 'paragraph',
                  content: [
                    { type: 'text', marks: [{ type: 'bold' }], text: 'No CTA' },
                    {
                      type: 'text',
                      text: ' — always end with a question or prompt ("Follow for more").',
                    },
                  ],
                },
              ],
            },
          ],
        },
        {
          type: 'heading',
          attrs: { level: 2 },
          content: [{ type: 'text', text: 'The Bottom Line' }],
        },
        {
          type: 'paragraph',
          content: [
            {
              type: 'text',
              text: "Building a faceless video channel with AI is no longer a side hustle experiment — it's a proven content strategy. With a faceless video creator like AutoReels, you can start today, post consistently, and grow an audience without ever appearing on camera.",
            },
          ],
        },
        {
          type: 'paragraph',
          content: [
            {
              type: 'text',
              text: 'The barrier to entry has never been lower. The only thing between you and your first viral reel is hitting "Create".',
            },
          ],
        },
      ],
    };

    const description =
      'A complete step-by-step guide to building a faceless video channel using AI tools — no camera, no editing skills, no face required.';

    await queryRunner.query(
      `INSERT INTO "blog_posts" (
        "id", "title", "slug", "description", "content", "category", "read_time", "keywords", "status", "published_at"
      ) VALUES (
        uuid_generate_v4(),
        $1, $2, $3, $4, $5, $6, $7, $8, now()
      )`,
      [
        'How to Create Faceless Videos with AI in 2026',
        'how-to-create-faceless-videos-ai-2026',
        description,
        JSON.stringify(postContent),
        'Guide',
        '7 min read',
        [
          'faceless video creator',
          'how to make faceless videos',
          'AI faceless channel',
          'faceless YouTube channel',
          'AI video generator',
          'automated video creation',
        ],
        'published',
      ],
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "blog_admin_notes" DROP CONSTRAINT "FK_blog_admin_notes_post_id"`,
    );
    await queryRunner.query(`ALTER TABLE "blog_likes" DROP CONSTRAINT "FK_blog_likes_post_id"`);
    await queryRunner.query(
      `ALTER TABLE "blog_comments" DROP CONSTRAINT "FK_blog_comments_post_id"`,
    );
    await queryRunner.query(`DROP TABLE "blog_admin_notes"`);
    await queryRunner.query(`DROP TABLE "blog_likes"`);
    await queryRunner.query(`DROP TABLE "blog_comments"`);
    await queryRunner.query(`DROP TABLE "blog_posts"`);
    await queryRunner.query(`DROP TYPE "public"."blog_posts_status_enum"`);
  }
}
