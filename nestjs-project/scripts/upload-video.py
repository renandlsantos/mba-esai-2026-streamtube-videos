#!/usr/bin/env python3
"""Cliente multipart: Python 3, biblioteca padrão, memória limitada a uma parte."""
import argparse
import json
import mimetypes
import os
from pathlib import Path
import time
import urllib.error
import urllib.request


def upload_video(path, title, api, token):
    def api_call(method, route, body=None):
        data = None if body is None else json.dumps(body).encode()
        request = urllib.request.Request(api.rstrip('/') + route, data=data, method=method,
            headers={'Authorization': f'Bearer {token}', 'Content-Type': 'application/json'})
        with urllib.request.urlopen(request, timeout=60) as response:
            payload = response.read()
            return json.loads(payload) if payload else None

    size = path.stat().st_size
    if not 1 <= size <= 10 * 1024 ** 3:
        raise ValueError('O arquivo deve ter entre 1 byte e 10GiB.')
    content_type = mimetypes.guess_type(path.name)[0]
    if content_type not in ('video/mp4', 'video/webm', 'video/quicktime'):
        raise ValueError('Use MP4, WebM ou MOV.')
    video = api_call('POST', '/videos/uploads', {'title': title, 'size_bytes': size, 'content_type': content_type})
    video_id = video['id']
    print(f'Upload criado: {video_id}', flush=True)
    parts = []
    with path.open('rb') as source:
        for number in range(1, video['part_count'] + 1):
            signed = api_call('POST', f'/videos/{video_id}/upload-parts/{number}')
            part = source.read(video['part_size'])
            request = urllib.request.Request(signed['url'], data=part, method='PUT',
                headers={'Content-Length': str(len(part))})
            with urllib.request.urlopen(request, timeout=300) as response:
                etag = response.headers.get('ETag')
                if not etag:
                    raise RuntimeError('Storage não retornou ETag.')
                parts.append({'part_number': number, 'etag': etag})
            print(f'Parte {number}/{video["part_count"]} enviada', flush=True)
    api_call('POST', f'/videos/{video_id}/complete', {'parts': parts})
    deadline = time.monotonic() + 3600
    while time.monotonic() < deadline:
        status = api_call('GET', f'/videos/{video_id}/status')
        if status['status'] == 'ready':
            print(json.dumps({'status': 'ready', 'url': f'{api.rstrip("/")}/videos/{video["slug"]}/stream'}, indent=2))
            return
        if status['status'] == 'error':
            raise RuntimeError(f'Processamento falhou: {status.get("error_code")}')
        time.sleep(2)
    raise TimeoutError(f'Consulte o status de {video_id}; processamento ainda pendente.')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('video', type=Path)
    parser.add_argument('--title', required=True)
    parser.add_argument('--api', default='http://localhost:53000')
    args = parser.parse_args()
    token = os.environ.get('STREAMTUBE_TOKEN')
    if not token:
        parser.error('Defina STREAMTUBE_TOKEN com o access_token do login.')
    try:
        upload_video(args.video, args.title, args.api, token)
    except urllib.error.HTTPError as error:
        raise SystemExit(f'Falha HTTP {error.code}; o upload já criado pode ser cancelado pela API.') from None
    except (OSError, ValueError, RuntimeError) as error:
        raise SystemExit(str(error)) from None


if __name__ == '__main__':
    main()
