const core = require('@actions/core');
const github = require('@actions/github');
const hc = require('@actions/http-client');

try {
  // `who-to-greet` input defined in action metadata file
  const nameToGreet = core.getInput('who-to-greet');
  console.log(`Hello ${nameToGreet}!`);
  const time = (new Date()).toTimeString();
  core.setOutput("time", time);
  // Get the JSON webhook payload for the event that triggered the workflow
//   const payload = JSON.stringify(github.context.payload, undefined, 2)
//   console.log(`The event payload: ${payload}`);

  const commitUrl = github.context.payload.repository.commits_url

  const http = new hc.HttpClient('ping dashboard agent', [], {keepAlive: true})

  if(github.context.payload.commits) {
    github.context.payload.commits.forEach(element => {
        Promise.resolve(checkfiles(http, commitUrl, element.id))
    });
  }

} catch (error) {
  core.setFailed(error.message);
}

async function checkfiles( http ,base, sha) {

    const url = base.replaceAll('{/sha}', `/${sha}`)
    console.log('Url:', url)
    const result = await http.getJson(url).then(data => data.result)
    console.log('result:', result)

}