import importlib.util
import io
from pathlib import Path
import unittest
from unittest.mock import patch, sentinel
from urllib.error import HTTPError
from urllib.request import Request

spec = importlib.util.spec_from_file_location('upload_video', Path(__file__).with_name('upload-video.py'))
client = importlib.util.module_from_spec(spec)
spec.loader.exec_module(client)

class RateLimitTests(unittest.TestCase):
    def test_respects_retry_after_then_returns_success(self):
        error = HTTPError('http://example.test', 429, 'limited', {'Retry-After': '12'}, io.BytesIO())
        with patch.object(client.urllib.request, 'urlopen', side_effect=[error, sentinel.response]) as send, patch.object(client.time, 'sleep') as sleep:
            self.assertIs(client.open_with_retry(Request('http://example.test')), sentinel.response)
            self.assertEqual(send.call_count, 2)
            sleep.assert_called_once_with(12)

    def test_bounds_retries_and_uses_backoff_without_header(self):
        errors = [HTTPError('http://example.test', 429, 'limited', {}, io.BytesIO()) for _ in range(3)]
        with patch.object(client.urllib.request, 'urlopen', side_effect=errors) as send, patch.object(client.time, 'sleep') as sleep:
            with self.assertRaises(HTTPError):
                client.open_with_retry(Request('http://example.test'), attempts=3)
            self.assertEqual(send.call_count, 3)
            self.assertEqual([call.args[0] for call in sleep.call_args_list], [1, 2])

    def test_does_not_retry_other_http_errors(self):
        error = HTTPError('http://example.test', 403, 'forbidden', {}, io.BytesIO())
        with patch.object(client.urllib.request, 'urlopen', side_effect=error) as send, patch.object(client.time, 'sleep') as sleep:
            with self.assertRaises(HTTPError):
                client.open_with_retry(Request('http://example.test'))
            self.assertEqual(send.call_count, 1)
            sleep.assert_not_called()

if __name__ == '__main__':
    unittest.main()
