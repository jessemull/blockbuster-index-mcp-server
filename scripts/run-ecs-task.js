#!/usr/bin/env node

const { spawn } = require('child_process');

const signalType = process.argv[2];

if (!signalType) {
  console.error('Please provide a signal name!');
  process.exit(1);
}

const subnets = process.env.ECS_SUBNETS;
const securityGroups = process.env.ECS_SECURITY_GROUPS;
const assignPublicIp = process.env.ECS_ASSIGN_PUBLIC_IP || 'ENABLED';

if (!subnets || !securityGroups) {
  console.error(
    'ECS_SUBNETS and ECS_SECURITY_GROUPS environment variables are required',
  );
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
  `awsvpcConfiguration={subnets=[${subnets}],securityGroups=[${securityGroups}],assignPublicIp=${assignPublicIp}}`,
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
