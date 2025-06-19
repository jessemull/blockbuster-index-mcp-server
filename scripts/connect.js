require("dotenv").config();
const { spawn } = require("child_process");

const sshPrivateKeyPath = process.env.SSH_PRIVATE_KEY_PATH;
const sshUser = process.env.SSH_USER;
const sshHost = process.env.SSH_HOST;

const sshCommand = [
  "-i",
  sshPrivateKeyPath,
  "-p",
  "22",
  `${sshUser}@${sshHost}`,
];

console.log(`Connecting to bastion host...`);

const sshProcess = spawn("ssh", sshCommand, { stdio: "inherit" });

sshProcess.on("close", (code) => {
  console.log(`SSH process exited with code ${code}`);
});
