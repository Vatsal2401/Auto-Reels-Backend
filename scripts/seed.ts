import { DataSource } from 'typeorm';
import { User } from '../src/auth/entities/user.entity';
import { Video, VideoStatus } from '../src/video/entities/video.entity';
import * as bcrypt from 'bcrypt';

const dataSource = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  username: process.env.DB_USERNAME || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  database: process.env.DB_DATABASE || 'ai_reels',
  entities: [User, Video],
  synchronize: false,
});

async function seed() {
  try {
    await dataSource.initialize();
    console.log('📦 Seeding database...');

    const userRepository = dataSource.getRepository(User);
    const videoRepository = dataSource.getRepository(Video);

    // Create test user
    const existingUser = await userRepository.findOne({
      where: { email: 'test@example.com' },
    });

    let user: User;
    if (existingUser) {
      user = existingUser;
      console.log('✅ Test user already exists');
    } else {
      const passwordHash = await bcrypt.hash('password123', 10);
      user = userRepository.create({
        email: 'test@example.com',
        password_hash: passwordHash,
        name: 'Test User',
        email_verified: true,
        credits_balance: 10, // Give test user 10 credits
        is_premium: false,
      });
      user = await userRepository.save(user);
      console.log('✅ Created test user: test@example.com / password123');
    }

    // Create sample videos
    const videoCount = await videoRepository.count({
      where: { user_id: user.id },
    });

    if (videoCount === 0) {
      const sampleVideos = [
        {
          topic: 'How to start a startup',
          status: VideoStatus.COMPLETED,
          script: 'Starting a startup requires passion, determination, and a great idea...',
          final_video_url: 'https://example.com/video1.mp4',
        },
        {
          topic: '10 productivity tips for developers',
          status: VideoStatus.PROCESSING,
          script: null,
        },
        {
          topic: 'The future of AI in content creation',
          status: VideoStatus.PENDING,
          script: null,
        },
      ];

      for (const videoData of sampleVideos) {
        const video = videoRepository.create({
          ...videoData,
          user_id: user.id,
        });
        await videoRepository.save(video);
      }

      console.log(`✅ Created ${sampleVideos.length} sample videos`);
    } else {
      console.log('✅ Sample videos already exist');
    }

    console.log('');
    console.log('✨ Seeding complete!');
    console.log('');
    console.log('Test credentials:');
    console.log('  Email: test@example.com');
    console.log('  Password: password123');
    console.log('  Credits: 10');
  } catch (error) {
    console.error('❌ Seeding failed:', error);
    process.exit(1);
  } finally {
    await dataSource.destroy();
  }
}

seed();
