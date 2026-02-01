export enum MediaAssetType {
    SCRIPT = 'script',
    AUDIO = 'audio',
    IMAGE = 'image',
    CAPTION = 'caption',
    VIDEO = 'video',
    AVATAR = 'avatar',
}

export enum MediaType {
    IMAGE = 'image',
    VIDEO = 'video',
    AVATAR = 'avatar',
    AUDIO = 'audio',
}

export enum MediaStatus {
    PENDING = 'pending',
    PROCESSING = 'processing',
    COMPLETED = 'completed',
    FAILED = 'failed',
}

export const MEDIA_FLOWS: Record<string, { steps: string[]; dependencies: Record<string, string[]> }> = {
    videoMotion: {
        steps: ['script', 'audio', 'captions', 'images', 'render'],
        dependencies: {
            script: [],
            audio: ['script'],
            captions: ['audio'],
            images: ['script'],
            render: ['images', 'captions'],
        },
    },
    directAudio: {
        steps: ['script', 'audio'],
        dependencies: {
            script: [],
            audio: ['script'],
        },
    },
    image: {
        steps: ['image'],
        dependencies: {
            image: [],
        },
    },
    avatar: {
        steps: ['script', 'audio', 'avatar', 'render'],
        dependencies: {
            script: [],
            audio: ['script'],
            avatar: ['audio'],
            render: ['avatar'],
        },
    },
    directVideoWithAudio: {
        steps: ['script', 'captions', 'video'],
        dependencies: {
            script: [],
            captions: ['script'],
            video: ['captions'],
        },
    },
    videoWithImages: {
        steps: ['script', 'audio', 'captions', 'images', 'video', 'render'],
        dependencies: {
            script: [],
            audio: ['script'],
            captions: ['audio'],
            images: ['script'],
            video: ['images', 'captions'],
            render: ['video'],
        },
    },
    captions: {
        steps: ['script', 'caption'],
        dependencies: {
            script: [],
            caption: ['script'],
        },
    },
    directVideoWithoutCaption: {
        steps: ['script', 'video'],
        dependencies: {
            script: [],
            video: ['script'],
        },
    },
};
