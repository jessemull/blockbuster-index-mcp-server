const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const signalsDir = path.join(__dirname, '..', 'src', 'signals');

// Get all directory names from src/signals...

const getSignalNames = () => {
  try {
    const items = fs.readdirSync(signalsDir, { withFileTypes: true });
    return items.filter((item) => item.isDirectory()).map((item) => item.name);
  } catch (error) {
    console.error('Error reading signals directory: ', error.message);
    return [];
  }
};

// Run a single signal...

const runSignal = (signalName) => {
  return new Promise((resolve) => {
    console.log(`Launching ECS task for: ${signalName}`);

    const child = spawn('node', ['scripts/run-ecs-task.js', signalName], {
      stdio: 'inherit',
      shell: true,
    });

    child.on('close', (code) => {
      if (code === 0) {
        console.log(`ECS task launched for ${signalName}`);
      } else {
        console.error(`Failed to launch ECS task for ${signalName}`);
      }
      resolve();
    });

    child.on('error', (error) => {
      console.error(
        `Error launching ECS task for ${signalName}:`,
        error.message,
      );
      resolve();
    });
  });
};

// Run all signals...

const runAllSignals = async () => {
  const signalNames = getSignalNames();

  if (signalNames.length === 0) {
    console.error('No signals found in src/signals directory');
    process.exit(1);
  }

  console.log(`Found ${signalNames.length} signals: ${signalNames.join(', ')}`);
  console.log('Launching all ECS tasks...\n');

  for (const signalName of signalNames) {
    await runSignal(signalName);
  }

  console.log(
    '\nAll ECS tasks have been launched. Check the AWS ECS console for task status.',
  );
};

// Run the script...

if (require.main === module) {
  runAllSignals().catch((error) => {
    console.error('Fatal error:', error.message);
    process.exit(1);
  });
}
