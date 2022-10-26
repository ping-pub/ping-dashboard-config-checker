const core = require('@actions/core');
const github = require('@actions/github');
const hc = require('@actions/http-client');

try {

    const time = (new Date()).toTimeString();
    core.setOutput("time", time);

    const commitUrl = github.context.payload.repository.commits_url

    // console.log('check update for:', JSON.stringify(github.context.payload))

    const http = new hc.HttpClient('ping dashboard agent', [], { keepAlive: true })

    // if (github.context.payload.commits) {
    //     github.context.payload.commits.forEach(element => {
    //         Promise.resolve(checkfiles(http, commitUrl, element.id))
    //     });
    // }

    if(github.context.payload.after) {
        Promise.resolve(checkfiles(http, commitUrl, github.context.payload.after))
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
            console.log(`check if ${f.filename} is valid`)
            const conf = await http.getJson(f.raw_url).then(data => data.result)
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
                let h = ''
                try {
                    for ( h of conf.api) {
                        core.info(`checking host: ${h}`)
                        if(!h.startsWith('https')) {
                            core.error(`https is required: ${h}`)
                        }

                        const info = await http.getJson(`${h}/cosmos/base/tendermint/v1beta1/node_info`)
                            .then(data => data.result)

                        if (`v${conf.sdk_version}` !== info.application_version.cosmos_sdk_version) {
                            core.notice(`${h} API versions do not matched! v${conf.sdk_version} <> ${info.application_version.cosmos_sdk_version}`)
                        }
                    }
                } catch (err) {
                    core.setFailed(`api ${h} is not available, make sure that CORS is enabled!`)
                }
                if (!hasErr) core.info('api is ok!', conf.api)
            } else {
                core.error('api is required')
            }

            // 3.rpc
            if (Array.isArray(conf.rpc)) {
                let hasErr = false
                let host = ''
                try {
                    for (host of conf.rpc) {
                        core.info(`checking host: ${host}`)
                        const info = await http.getJson(`${host}/block`)
                            .then(data => data.result)

                        if(f.filename.indexOf('/mainnet') > -1 ) {
                            const val = info.result.block.last_commit.signatures.length
                            core.info(`number of validators: ${val}`)
                            if(val < 10) {
                                core.setFailed('10+ validators is required for mainnet')
                            }
                        }
                    }
                } catch (err) {
                    core.setFailed(`api ${host} is not available, make sure that CORS is enabled!`)
                }
                if (!hasErr) core.info('rpc is ok!', conf.rpc)
            } else {
                core.error('rpc is required')
            }

            // 2.assets
            if (Array.isArray(conf.assets)) {
                core.info('assets is ok!', conf.assets)
            } else {
                core.error('assets is required')
            }

        }
    }

}