import { exec } from 'child_process';
import { promisify } from 'util';
import chalk from 'chalk';
import path from 'path';

const execAsync = promisify(exec);

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
    const args = [
      'pack',
      courseId,
      '--server', server,
      '--output', outputDir
    ];
    
    if (username) {
      args.push('--username', username);
    }
    
    if (password) {
      args.push('--password', password);
    }
    
    const command = `node ${path.join(process.cwd(), 'dist', 'cli.js')} ${args.join(' ')}`;
    
    try {
      console.log(chalk.gray(`🔄 Packing course: ${courseId}`));
      
      const { stdout, stderr } = await execAsync(command, {
        cwd: process.cwd(),
        maxBuffer: 1024 * 1024 * 10 // 10MB buffer for large outputs
      });
      
      if (stdout) {
        console.log(stdout);
      }
      
      if (stderr) {
        console.error(chalk.yellow(stderr));
      }
      
      console.log(chalk.green(`✅ Successfully packed course: ${courseId}`));
      
    } catch (error: any) {
      console.error(chalk.red(`❌ Failed to pack course ${courseId}:`));
      console.error(chalk.red(error.message));
      
      // Continue with other courses instead of failing completely
      continue;
    }
  }
  
  console.log(chalk.green(`\n🎉 All courses packed to: ${outputDir}`));
}