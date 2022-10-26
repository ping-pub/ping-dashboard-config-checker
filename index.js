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

    const http = new hc.HttpClient('ping dashboard agent', [], { keepAlive: true })

    if (github.context.payload.commits) {
        github.context.payload.commits.forEach(element => {
            Promise.resolve(checkfiles(http, commitUrl, element.id))
        });
    }

} catch (error) {
    core.setFailed(error.message);
}

async function checkfiles(http, base, sha) {

    // fetch latest commits
    const url = base.replaceAll('{/sha}', `/${sha}`)
    const result = await http.getJson(url).then(data => data.result)

    // check if configs exists and valid
    for (const f of result.files) {
        if (f.filename.startsWith('src/chains') && f.filename.endsWith('.json')) {
            console.log(f.raw_url)
            const conf = await http.getJson(f.raw_url).then(data => data.result)
            console.log('config:', conf)
            /// check list
            // 1. chain name
            if (conf.chain_name) {
                core.info('chain_name is ok!', conf.chain_name)
            } else {
                core.error('chain_name is required')
            }

            // 2.api
            if (Array.isArray(conf.api)) {
                let hasErr = false
                for(const h of conf.api) {
                    const info = await http.getJson(`${h}/cosmos/base/tendermint/v1beta1/node_info`)
                    .then(data => data.result)
                    
                    console.log(info.application_version.cosmos_sdk_version)
                    if(conf.sdk_version !== info.application_version.cosmos_sdk_version) {
                        core.notice(`API versions do not matched! ${conf.sdk_version} <> ${info.application_version.cosmos_sdk_version}`)
                    }
                }
                if(!hasErr) core.info('api is ok!', conf.api)
            } else {
                core.error('api is required')
            }

            // 3.rpc
            if (Array.isArray(conf.rpc)) {
                core.info('rpc is ok!', conf.rpc)
            } else {
                core.error('rpc is required')
            }

            // 2.assets
            if (Array.isArray(conf.assets)) {
                core.info('assets is ok!', conf.assets)
            } else {
                core.error('assets is required')
            }

        } else {
            console.log('others:', f.filename)
        }
    }

}