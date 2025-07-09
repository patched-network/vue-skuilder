
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');

const packagesDir = path.join(__dirname, '../packages');
const packages = fs.readdirSync(packagesDir);

const commands = [];
const names = [];

for (const pkg of packages) {
    const pkgPath = path.join(packagesDir, pkg, 'package.json');
    if (fs.existsSync(pkgPath)) {
        const pkgJson = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
        if (pkgJson.scripts && pkgJson.scripts.dev) {
            commands.push(`"yarn workspace ${pkgJson.name} dev"`);
            names.push(pkg.replace(/-ui$/, ''));
        }
    }
}

if (commands.length > 0) {
    const concurrentlyCommand = `concurrently -n "${names.join(',')}" ${commands.join(' ')}`;
    console.log('Running command:', concurrentlyCommand);
    const child = exec(concurrentlyCommand, (error, stdout, stderr) => {
        if (error) {
            console.error(`exec error: ${error}`);
            return;
        }
        console.log(`stdout: ${stdout}`);
        console.error(`stderr: ${stderr}`);
    });
    child.stdout.pipe(process.stdout);
    child.stderr.pipe(process.stderr);
} else {
    console.log('No packages with a "dev" script found.');
}
