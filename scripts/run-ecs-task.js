#!/usr/bin/env node

const { spawn } = require('child_process');

const ENVIRONMENT = 'dev';
const CLUSTER_NAME = `blockbuster-index-${ENVIRONMENT}`;
const TASK_DEFINITION_FAMILY = `blockbuster-index-task-${ENVIRONMENT}`;

async function runCommand(args) {
  return new Promise((resolve, reject) => {
    console.log(`Running: aws ${args.join(' ')}`);

    const child = spawn('aws', args, {
      stdio: 'inherit',
      shell: true,
    });

    child.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`Command failed with exit code ${code}`));
      }
    });

    child.on('error', (error) => {
      reject(error);
    });
  });
}

async function getLatestTaskDefinition() {
  return new Promise((resolve, reject) => {
    const child = spawn(
      'aws',
      [
        'ecs',
        'describe-task-definition',
        '--task-definition',
        TASK_DEFINITION_FAMILY,
      ],
      {
        stdio: ['inherit', 'pipe', 'inherit'],
        shell: true,
      },
    );

    let output = '';
    child.stdout.on('data', (data) => {
      output += data.toString();
    });

    child.on('close', (code) => {
      if (code === 0) {
        try {
          const result = JSON.parse(output);
          resolve(result.taskDefinition.taskDefinitionArn);
        } catch (error) {
          reject(new Error('Failed to parse task definition output'));
        }
      } else {
        reject(
          new Error(`Failed to get task definition with exit code ${code}`),
        );
      }
    });

    child.on('error', (error) => {
      reject(error);
    });
  });
}

async function runECSTask() {
  try {
    console.log(
      `Manually triggering ECS task for ${ENVIRONMENT} environment...`,
    );
    console.log(`Cluster: ${CLUSTER_NAME}`);
    console.log(`Task Definition Family: ${TASK_DEFINITION_FAMILY}`);
    console.log('');

    const taskDefinitionArn = await getLatestTaskDefinition();
    console.log(`Using task definition: ${taskDefinitionArn}`);
    console.log('');

    await runCommand([
      'ecs',
      'run-task',
      '--cluster',
      CLUSTER_NAME,
      '--task-definition',
      taskDefinitionArn,
      '--launch-type',
      'FARGATE',
      '--network-configuration',
      'awsvpcConfiguration={subnets=[subnet-02ce757a,subnet-2655df7b,subnet-e22085a8,subnet-badfdd91],securityGroups=[sg-09812900f87093af6],assignPublicIp=ENABLED}',
    ]);

    console.log('');
    console.log('ECS task started successfully!');
    console.log('');
    console.log('To monitor the task:');
    console.log(`   aws ecs list-tasks --cluster ${CLUSTER_NAME}`);
    console.log('');
    console.log('To view logs:');
    console.log(
      `   aws logs tail /ecs/blockbuster-index-${ENVIRONMENT} --follow`,
    );
    console.log('');
    console.log('To describe a specific task:');
    console.log(
      '   aws ecs describe-tasks --cluster <cluster-name> --tasks <task-arn>',
    );
  } catch (error) {
    console.error('Failed to run ECS task:', error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  runECSTask();
}

module.exports = { runECSTask };
