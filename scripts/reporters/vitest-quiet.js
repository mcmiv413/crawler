import * as fs from 'fs';
import * as path from 'path';

export default class QuietReporter {
  constructor() {
    this.failures = [];
    this.startTime = Date.now();
    this.passCount = 0;
    this.failCount = 0;
    this.logDir = '.validate-logs';
  }

  onCollected(files) {
    // Store total test count by counting actual 'test' type tasks
    this.totalTests = this.countTests(files || []);
  }

  countTests(files) {
    let count = 0;
    const countTasksRecursive = (tasks) => {
      for (const task of tasks || []) {
        if (task.type === 'test') {
          count++;
        } else if (task.type === 'suite' && task.tasks) {
          countTasksRecursive(task.tasks);
        }
      }
    };

    for (const file of files) {
      countTasksRecursive(file.tasks || []);
    }
    return count;
  }

  onTaskUpdate() {
    // Don't count in onTaskUpdate - we'll use onFinished to get final counts
  }

  recordFailure(file, task) {
    const suite = [];
    let current = task.suite;
    while (current) {
      suite.unshift(current.name);
      current = current.suite;
    }

    const error = task.result?.error;
    const errorStr = error ? this.formatError(error) : 'Unknown error';

    this.failures.push({
      file: file.filepath || 'unknown',
      suite,
      name: task.name,
      error: errorStr,
    });
  }

  formatError(err) {
    if (err instanceof Error) {
      return err.message.split('\n').slice(0, 5).join('\n');
    }
    return String(err);
  }

  onFinished(files) {
    const duration = ((Date.now() - this.startTime) / 1000).toFixed(1);

    // Count final pass/fail from files
    const final = this.countFinalResults(files || []);
    const total = final.pass + final.fail;
    this.passCount = final.pass;
    this.failCount = final.fail;

    if (final.fail === 0) {
      const message = total > 0
        ? `✓ Tests: ${final.pass} passed (${duration}s)`
        : `✓ Tests: 0 tests found (${duration}s)`;
      console.log(message);
    } else {
      console.error(`✗ Tests: ${final.fail} failed, ${final.pass} passed (${duration}s)\n`);
      this.collectFailures(files || []);
      this.printFailures();
      this.writeLogFile();
    }
  }

  countFinalResults(files) {
    let pass = 0;
    let fail = 0;

    const countRecursive = (tasks) => {
      for (const task of tasks || []) {
        if (task.type === 'test') {
          if (task.result?.state === 'pass') {
            pass++;
          } else if (task.result?.state === 'fail') {
            fail++;
          }
        } else if (task.type === 'suite' && task.tasks) {
          countRecursive(task.tasks);
        }
      }
    };

    for (const file of files) {
      countRecursive(file.tasks || []);
    }

    return { pass, fail };
  }

  collectFailures(files) {
    const collectRecursive = (tasks, filePath) => {
      for (const task of tasks || []) {
        if (task.type === 'test' && task.result?.state === 'fail') {
          this.recordFailure({ filepath: filePath }, task);
        } else if (task.type === 'suite' && task.tasks) {
          collectRecursive(task.tasks, filePath);
        }
      }
    };

    for (const file of files) {
      collectRecursive(file.tasks || [], file.filepath || 'unknown');
    }
  }

  printFailures() {
    const maxDisplay = Math.min(this.failures.length, 5);
    const showMore = maxDisplay < this.failures.length;

    if (showMore) {
      console.error(`  Showing first ${maxDisplay} of ${this.failures.length} failures:\n`);
    }

    for (let i = 0; i < maxDisplay; i++) {
      const failure = this.failures[i];
      const filePath = failure.file.replace(process.cwd(), '').replace(/^\//, '');
      const location = failure.suite.length > 0
        ? `${failure.suite.join(' > ')} > ${failure.name}`
        : failure.name;

      console.error(`  FAIL ${filePath}`);
      console.error(`    ${location}`);
      if (failure.error) {
        failure.error.split('\n').forEach((line) => {
          if (line.trim()) {
            console.error(`    ${line}`);
          }
        });
      }
      console.error();
    }

    if (showMore) {
      console.error(`  Full output → .validate-logs/test.log\n`);
    }
  }

  writeLogFile() {
    try {
      if (!fs.existsSync(this.logDir)) {
        fs.mkdirSync(this.logDir, { recursive: true });
      }

      const lines = [];
      lines.push(`# Test Failures\n`);
      lines.push(`Total: ${this.failCount} failed, ${this.passCount} passed\n`);
      lines.push('---\n');

      for (const failure of this.failures) {
        const filePath = failure.file.replace(process.cwd(), '').replace(/^\//, '');
        const location = failure.suite.length > 0
          ? `${failure.suite.join(' > ')} > ${failure.name}`
          : failure.name;

        lines.push(`\n## ${filePath}\n`);
        lines.push(`**${location}**\n`);
        if (failure.error) {
          lines.push('```');
          lines.push(failure.error);
          lines.push('```\n');
        }
      }

      const logPath = path.join(this.logDir, 'test.log');
      fs.writeFileSync(logPath, lines.join('\n'), 'utf-8');
    } catch (err) {
      console.error(`Failed to write log file: ${err}`);
    }
  }
}
