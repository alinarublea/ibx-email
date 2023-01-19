import fetch from 'node-fetch';
import openwhisk from 'openwhisk';


async function list(indexUrl) {
    const resp = await fetch(indexUrl);

    if (!resp.ok) {
        return { statusCode: resp.status, body: resp.statusText };
    }

    const { data } = await resp.json();
    const entities = data.map(({ path, title, lastModified }) => ({
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

function permalink(permalink) {
    const path = permalink.substring('/permalink/'.length);
    const apiHost = process.env['__OW_API_HOST'];
    const namespace = process.env['__OW_NAMESPACE'];
    const location = `https://${namespace}.adobeioruntime.net/api/v1/web/franklin/acc/${path}`;
    return { statusCode: 302, headers: { location } };
}

export async function main(params) {
    try {
        const host = `main--ibx-email--buuhuu.hlx.${params['preview'] ? 'page' : 'live'}`;

        if (params['__ow_path'] === '/api/content/sites/campaigns.json') {
            return list(`https://${host}/query-index.json`);
        } else if (params['__ow_path'].endsWith('.campaign.link.json')) {
            const [path] = params['__ow_path'].split('.');
            return link(`https://${host}/query-index.json`, path);
        } else if (params['__ow_path'].endsWith('.campaign.content.json')) {
            const [path] = params['__ow_path'].split('.');
            return content(`https://${host}/query-index.json`, path, params['preview']);
        } else if (params['__ow_path'].indexOf('/permalink/') === 0) {
            return permalink(params['__ow_path']);
        }

        return { statusCode: 404, body: 'unknown path: ' + params['__ow_path'] };
    } catch(err) {
        return { statusCode: 503, body: err.message };
    }
}
