#!/usr/bin/env node

const { spawn } = require('child_process');

const signalType = process.argv[2];

if (!signalType) {
  console.error('Please provide a signal name!');
  process.exit(1);
}

const taskDefinition = `blockbuster-index-${signalType}-task-dev`;

console.log(`Running ECS task: ${taskDefinition}`);

const awsArgs = [
  'ecs',
  'run-task',
  '--cluster',
  'blockbuster-index-dev',
  '--task-definition',
  taskDefinition,
  '--launch-type',
  'FARGATE',
  '--network-configuration',
  'awsvpcConfiguration={subnets=[subnet-02ce757a,subnet-2655df7b,subnet-e22085a8,subnet-badfdd91],securityGroups=[sg-09812900f87093af6],assignPublicIp=ENABLED}',
];

const proc = spawn('aws', awsArgs, {
  stdio: 'inherit',
  shell: true,
});

proc.on('exit', (code) => {
  if (code === 0) {
    console.log(`ECS task ${taskDefinition} started successfully!`);
  } else {
    console.error(`ECS task ${taskDefinition} failed with code: ${code}`);
    process.exit(code);
  }
});

proc.on('error', (error) => {
  console.error(`Error running ECS task: ${error.message}`);
  process.exit(1);
});
