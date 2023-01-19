import fetch from 'node-fetch';
import openwhisk from 'openwhisk';


async function list(indexUrl) {
    const resp = await fetch(indexUrl);

    if (!resp.ok) {
        return { statusCode: resp.status, body: resp.statusText };
    }

    const { data } = await resp.json();
    const entities = data
        .filter(({ path }) => {
            // only include documents that are in a folder (not from top level)
            return path.split('/').length > 2;
        })
        .map(({ path, title, lastModified }) => ({
            links: [
                { rel: ['content'], href: `${path}` }
            ],
            class: "content/page",
            properties: {
                'dc:title': title,
                'name': path.split('/').pop() || 'index',
                'cq:acApproved': true,
                'cq:lastModified': new Date(lastModified * 1000).toISOString(),
                'cq:acLinks': []
            }
        }));

    return { statusCode: 200, body: { entities }};
}

async function link(indexUrl, path) {
    const resp = await fetch(indexUrl);

    if (!resp.ok) {
        return { statusCode: resp.status, body: resp.statusText };
    }

    const { data } = await resp.json();
    const entry = data.find(value => value.path === path);

    if (!entry) {
        return { statusCode: 404, body: 'path not found in index: ' + path };
    }

    const links = [{ rel: '/api/classes/permalink', href: `/permalink${path}` }]
    const properties = { 'title': entry.title }

    return { statusCode: 200, body: { links, properties }};
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
        params: { preview, '__ow_path': path }
    });

    if (body) {
        return {
            statusCode: 200,
            body: {
                html: body,
                subject: entry.subject || entry.title,
                text: entry.text || '',
                lastModified: entry.lastModified * 1000,
                approved: true
            }
        };
    } else {
        return { statusCode: 404, body: 'content not rendered' };
    }
}

function permalink(permalink, preview) {
    const namespace = process.env['__OW_NAMESPACE'];
    let path = permalink.substring('/permalink/'.length);
    
    if (preview) {
        path = 'preview/' + path;
    } else if (!preview && typeof preview !== 'undefined') {
        path = 'live/' + path;
    }
    
    const location = `https://${namespace}.adobeioruntime.net/api/v1/web/franklin/acc/${path}`;
    return { statusCode: 302, headers: { location } };
}

export async function main(params) {
    try {
        let [path] = params['__ow_path'].split('.');
        let preview = undefined;
        if (path.indexOf('/preview/') === 0) {
            live = true;
            path = path.subject('/preview/'.length);
        } else if (path.indexOf('/live/') === 0) {
            preview = false;
            path = path.subject('/live/'.length);
        } 

        const host = `main--ibx-email--buuhuu.hlx.${preview ? 'page' : 'live'}`;
        const indexUrl = `https://${host}/query-index.json`;

        if (params['__ow_path'] === '/api/content/sites/campaigns.json') {
            // list pages 
            return list(indexUrl);
        } else if (params['__ow_path'].endsWith('.campaign.link.json')) {
            // return a link json object with a permalink (/permalink/)
            return link(indexUrl, path);
        } else if (params['__ow_path'].endsWith('.campaign.unlink.json')) {
            // noop
            return { statusCode: 200 };
        } else if (params['__ow_path'].endsWith('.campaign.content.json')) {
            // invoke franklin/ssr
            return content(indexUrl, path, preview);
        } else if (params['__ow_path'].indexOf('/permalink/') === 0) {
            // redirect from the /permalink/ to the actual path
            return permalink(path, preview);
        }

        return { statusCode: 404, body: 'unknown path: ' + params['__ow_path'] };
    } catch(err) {
        return { statusCode: 503, body: err.message };
    }
}
