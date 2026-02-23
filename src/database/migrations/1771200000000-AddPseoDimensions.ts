import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPseoDimensions1771200000000 implements MigrationInterface {
  name = 'AddPseoDimensions1771200000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "pseo_seed_dimensions" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "name" text NOT NULL,
        "values" text[] NOT NULL DEFAULT '{}',
        "description" text,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_pseo_seed_dimensions_name" UNIQUE ("name"),
        CONSTRAINT "PK_pseo_seed_dimensions" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      INSERT INTO "pseo_seed_dimensions" ("name", "values", "description") VALUES
      ('niches', ARRAY['finance','psychology','history','motivation','science-facts','health','ai-tech','business','philosophy','nature-space'], 'Content niches for reel generation'),
      ('tones', ARRAY['motivational','educational','humorous','storytelling','controversial'], 'Content tones and styles'),
      ('platforms', ARRAY['instagram','youtube','tiktok','linkedin','facebook'], 'Social media platforms'),
      ('personas', ARRAY['coaches','real-estate-agents','fitness-trainers','marketers','entrepreneurs','educators','content-creators','youtubers','instagram-influencers','small-business-owners'], 'Target user personas'),
      ('countries', ARRAY['india','united-states','united-kingdom','australia','canada','nigeria','south-africa','philippines','indonesia','brazil'], 'Target countries for location pages'),
      ('competitors', ARRAY['invideo','canva','pictory','synthesia','descript','heygen','veed','capcut','runway','adobe-express'], 'Competing tools for comparison pages'),
      ('integrations', ARRAY['wordpress','shopify','buffer','hootsuite','later','instagram','youtube','tiktok','linkedin','facebook'], 'Platform integrations'),
      ('languages', ARRAY['hindi','spanish','french','arabic','portuguese','german','japanese','indonesian','bengali','tamil'], 'Target languages for translation pages'),
      ('glossary_terms', ARRAY['faceless-reel','ai-voiceover','viral-hook','caption-sync','kenburns-effect','b-roll','hook-copy','voiceover','text-to-speech','auto-captions','reel-template','short-form-video','faceless-channel','ai-script','video-automation','stock-footage','dynamic-subtitles','talking-head','faceless-youtube','niche-content','content-calendar','viral-formula','engagement-rate','watch-time','cta-overlay','aspect-ratio','vertical-video','scroll-stopper','pattern-interrupt','content-pillar','repurpose-content','ai-generated-video','social-media-automation','content-batch','video-seo','thumbnail-hook','voiceover-script','scene-transition','b-roll-footage','music-sync','ai-editing','faceless-brand','niche-down','creator-economy','monetization-strategy','viral-content','shorts-algorithm','reels-algorithm','tiktok-fyp','content-repurposing'], 'Glossary terms for glossary playbook'),
      ('tool_types', ARRAY['ai-video-generator','faceless-video-maker','reel-creator','shorts-generator','tiktok-maker','voiceover-tool','caption-generator','script-writer','content-scheduler','video-repurposer'], 'Tool type categories for profile pages'),
      ('plans', ARRAY['starter','pro','agency'], 'AutoReels subscription plans')
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "pseo_seed_dimensions"`);
  }
}
