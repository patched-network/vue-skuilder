import { execFile } from 'child_process';
import { promisify } from 'util';
import chalk from 'chalk';
import path from 'path';

const execFileAsync = promisify(execFile);

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

  for (const courseId of courseIds) {
    const args = ['pack', courseId, '--server', server, '--output', outputDir];

    if (username) {
      args.push('--username', username);
    }

    if (password) {
      args.push('--password', password);
    }

    const cliPath = path.join(process.cwd(), 'dist', 'cli.js');
    const commandArgs = ['pack', courseId, '--server', server, '--output', outputDir];

    if (username) {
      commandArgs.push('--username', username);
    }

    if (password) {
      commandArgs.push('--password', password);
    }

    try {
      console.log(chalk.gray(`🔄 Packing course: ${courseId}`));

      const { stdout, stderr } = await execFileAsync('node', [cliPath, ...commandArgs], {
        cwd: process.cwd(),
        maxBuffer: 1024 * 1024 * 10, // 10MB buffer for large outputs
      });

      if (stdout) {
        console.log(stdout);
      }

      if (stderr) {
        console.error(chalk.yellow(stderr));
      }

      console.log(chalk.green(`✅ Successfully packed course: ${courseId}`));
    } catch (error: unknown) {
      console.error(chalk.red(`❌ Failed to pack course ${courseId}:`));
      console.error(chalk.red(error instanceof Error ? error.message : String(error)));

      // Continue with other courses instead of failing completely
      continue;
    }
  }

  console.log(chalk.green(`\n🎉 All courses packed to: ${outputDir}`));
}
