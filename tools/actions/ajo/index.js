import fetch from 'node-fetch';
import openwhisk from 'openwhisk';


async function list(indexUrl) {
    const resp = await fetch(indexUrl);

    if (!resp.ok) {
        return { statusCode: resp.status, body: resp.statusText };
    }

    const body = await resp.json();

    return { statusCode: 200, body };
}

async function content(indexUrl, path, preview) {
    const resp = await fetch(indexUrl);

    if (!resp.ok) {
        return { statusCode: resp.status, body: resp.statusText };
    }

    const { data } = await resp.json();
    const entry = data.find(value => value.path === path);
    const ow = openwhisk();
    const { body } = await ow.actions.invoke({ 
        blocking: true,
        result: true,
        actionName: 'franklin/ssr', 
        params: { preview, '__ow_path': path, segmentConditions: true }
    });

    if (body) {
        return { statusCode: 200, body };
    } else {
        return { statusCode: 404, body: 'content not rendered' };
    }
}

export async function main(params) {
    try {
        let path = params['__ow_path'];
        let preview = undefined;
        if (path.indexOf('/preview/') === 0) {
            live = true;
            path = path.substring('/preview/'.length);
        } else if (path.indexOf('/live/') === 0) {
            preview = false;
            path = path.substring('/live/'.length);
        } 

        const host = `main--ibx-email--buuhuu.hlx.${preview ? 'page' : 'live'}`;
        const indexUrl = `https://${host}/query-index.json`;

        if (path === '/list.json') {
            // list pages 
            return list(indexUrl);
        } else if (path !== '/') {
            // invoke franklin/ssr
            return content(indexUrl, path, preview);
        }

        return { statusCode: 404, body: 'unknown path: ' + params['__ow_path'] };
    } catch(err) {
        return { statusCode: 503, body: err.message };
    }
}
