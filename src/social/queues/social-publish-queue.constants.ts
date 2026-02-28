export const SOCIAL_PUBLISH_QUEUE_YOUTUBE   = 'social-publish-youtube';
export const SOCIAL_PUBLISH_QUEUE_TIKTOK    = 'social-publish-tiktok';
export const SOCIAL_PUBLISH_QUEUE_INSTAGRAM = 'social-publish-instagram';

export const JOB_PUBLISH_POST = 'publish-post';

export const PLATFORM_RATE_LIMITS: Record<string, { max: number; duration: number }> = {
  youtube:   { max: 10, duration: 1000 }, // 10/sec — main limit is daily quota
  tiktok:    { max: 5,  duration: 1000 }, // 5/sec
  instagram: { max: 3,  duration: 1000 }, // conservative — Meta blocks easily
};
