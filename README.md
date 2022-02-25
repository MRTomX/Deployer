# Deployer

Purpose of this nodejs app is receiving incoming webhooks from version controlling providers such as GitHub, GitLab or BitBucket followed by launching of user defined actions (certain programs or script) wich may result in succesfull deployment. Currently is implented only PUSH action from GitLab, which is minimal functionality for my project. I hope that in neerest future I will continue in development and adding more actions and more providers. 

## Build

- Install: `npm install`
- Start: `npm start`

## Pro tips

### This app and supervisor

If you are using supervisor under root and using private-public key pair for smooth pulling from your git repository with non-root user, you may know that you could run this app supervised by supervisor effective under non-root user with option ``user`` in corresponding configuration file. But what you may not know that you must provide some enviroment vairables in that corresponding config too. In my case I must add this line to my config to ensure that my git pull will work properly.

`` environment=HOME="/home/gituser",USER="gituser" ``

Some details here https://supervisord.readthedocs.io/en/latest/subprocess.html#subprocess-environment

