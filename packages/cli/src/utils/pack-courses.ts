import chalk from 'chalk';
import path from 'path';
import { promises as fs } from 'fs';

export interface PackCoursesOptions {
  server: string;
  username?: string;
  password?: string;
  courseIds: string[];
  targetProjectDir: string;
}

/**
 * Pack courses using the existing CLI pack command
 * Outputs to targetProjectDir/public/static-courses/
 */
export async function packCourses(options: PackCoursesOptions): Promise<void> {
  const { server, username, password, courseIds, targetProjectDir } = options;

  // Output directory will be public/static-courses in the target project
  const outputDir = path.join(targetProjectDir, 'public', 'static-courses');

  console.log(chalk.cyan(`\n📦 Packing ${courseIds.length} course(s) to ${outputDir}...`));

  // Import the pack command function
  const { packCourse } = await import('../commands/pack.js');

  for (const courseId of courseIds) {
    try {
      console.log(chalk.gray(`🔄 Packing course: ${courseId}`));

      // Call the existing pack command directly instead of subprocess
      await packCourse(courseId, {
        server,
        username,
        password,
        output: outputDir,
        chunkSize: '1000',
        noAttachments: false
      });

      console.log(chalk.green(`✅ Successfully packed course: ${courseId}`));

      // Create course-level skuilder.json for the packed course
      const coursePath = path.join(outputDir, courseId);
      const manifestPath = path.join(coursePath, 'manifest.json');

      // Read the manifest to get course title
      let courseTitle = courseId;
      try {
        const manifestContent = await fs.readFile(manifestPath, 'utf-8');
        const manifest = JSON.parse(manifestContent);
        courseTitle = manifest.courseName || manifest.courseConfig?.name || courseId;
      } catch {
        console.warn(chalk.yellow(`⚠️  Could not read manifest for course title, using courseId`));
      }

      // Create course-level skuilder.json
      const courseSkuilderJson = {
        name: `@skuilder/course-${courseId}`,
        version: '1.0.0',
        description: courseTitle,
        content: {
          type: 'static',
          manifest: './manifest.json',
        },
      };

      await fs.writeFile(
        path.join(coursePath, 'skuilder.json'),
        JSON.stringify(courseSkuilderJson, null, 2)
      );

      console.log(chalk.gray(`📄 Created skuilder.json for course: ${courseId}`));
    } catch (error: unknown) {
      console.error(chalk.red(`❌ Failed to pack course ${courseId}:`));
      console.error(chalk.red(error instanceof Error ? error.message : String(error)));

      // Continue with other courses instead of failing completely
      continue;
    }
  }

  console.log(chalk.green(`\n🎉 All courses packed to: ${outputDir}`));
}
