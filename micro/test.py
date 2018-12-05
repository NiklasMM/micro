# micro
# Copyright (C) 2018 micro contributors
#
# This program is free software: you can redistribute it and/or modify it under the terms of the GNU
# Lesser General Public License as published by the Free Software Foundation, either version 3 of
# the License, or (at your option) any later version.
#
# This program is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without
# even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the GNU
# Lesser General Public License for more details.
#
# You should have received a copy of the GNU Lesser General Public License along with this program.
# If not, see <http://www.gnu.org/licenses/>.

"""Test utilites."""

from typing import Dict, List, Optional
from urllib.parse import urljoin

from tornado.httpclient import AsyncHTTPClient
from tornado.testing import AsyncTestCase

from .jsonredis import JSONRedis, RedisList, expect_opt_type, expect_type
from .micro import (Activity, Application, Collection, Editable, Object, Orderable, Settings,
                    Trashable, WithContent)
from .resource import Resource
from .util import randstr

class ServerTestCase(AsyncTestCase):
    """Subclass API: Server test case.

    .. attribute:: server

       :class:`server.Server` under test. Must be set by subclass.

    .. attribute:: client_user

       :class:`User` interacting with the server. May be set by subclass.
    """

    def setUp(self):
        super().setUp()
        self.server = None
        self.client_user = None

    def request(self, url, **args):
        """Run a request against the given *url* path.

        The request is issued by :attr:`client_user`, if set. This is a convenient wrapper around
        :meth:`tornado.httpclient.AsyncHTTPClient.fetch` and *args* are passed through.
        """
        headers = args.pop('headers', {})
        if self.client_user:
            headers.update({'Cookie': 'auth_secret=' + self.client_user.auth_secret})
        return AsyncHTTPClient().fetch(urljoin(self.server.url, url), headers=headers, **args)

class CatApp(Application):
    """Simple application for testing purposes.

    .. attribute:: cats

       See :class:`CatApp.Cats`.
    """

    class Cats(Collection['Cat'], Orderable):
        """Collection of all :class:`Cat`s."""

        def __init__(self, *, app: Application) -> None:
            super().__init__(RedisList('cats', app.r.r), expect=expect_type(Cat), app=app)
            Orderable.__init__(self)

        def create(self, name: str = None) -> 'Cat':
            """Create a cat."""
            cat = Cat.make(name=name, app=self.app)
            self.app.r.oset(cat.id, cat)
            self.app.r.rpush('cats', cat.id)
            return cat

    def __init__(self, redis_url: str = '') -> None:
        super().__init__(redis_url=redis_url)
        self.types.update({'Cat': Cat})
        self.cats = self.Cats(app=self)

    def do_update(self):
        r = JSONRedis(self.r.r)
        r.caching = False

        # Deprecated since 0.14.0
        cat = r.oget('Cat')
        if cat and 'activity' not in cat:
            cat['activity'] = Activity('Cat.activity', app=self, subscriber_ids=[]).json()
            r.oset(cat['id'], cat)
        # Deprecated TODO
        if cat and 'text' not in cat:
            cat['text'] = None
            cat['resource'] = None
            r.oset(cat['id'], cat)

    def create_settings(self):
        # pylint: disable=unexpected-keyword-arg; decorated
        return Settings(
            id='Settings', app=self, authors=[], title='CatApp', icon=None, icon_small=None,
            icon_large=None, provider_name=None, provider_url=None, provider_description={},
            feedback_url=None, staff=[], push_vapid_private_key=None, push_vapid_public_key=None,
            v=2)

    def sample(self):
        """Set up some sample data."""
        user = self.login()
        auth_request = user.set_email('happy@example.org')
        self.r.set('auth_request', auth_request.id)
        self.cats.create()

class Cat(Object, Editable, Trashable, WithContent):
    """Cute cat."""

    @staticmethod
    def make(*, name: str = None, app: Application) -> 'Cat':
        """Create a :class:`Cat` object."""
        id = 'Cat:{}'.format(randstr())
        return Cat(id=id, app=app, authors=[], trashed=False, text=None, resource=None, name=name,
                   activity=Activity(id='{}.activity'.format(id), app=app, subscriber_ids=[]))

    @staticmethod
    def parse(data: Dict[str, object], **args: object) -> 'Cat':
        return Cat(
            id=expect_type(str)(data['id']),
            app=expect_type(Application)(args['app']),
            authors=expect_type(list)(data['authors']),
            trashed=expect_type(bool)(data['trashed']),
            text=expect_opt_type(str)(data['text']),
            resource=expect_opt_type(Resource)(data['resource']),
            name=expect_opt_type(str)(data['name']),
            activity=expect_type(Activity)(data['activity']))

    def __init__(
            self, *, id: str, app: Application, authors: List[str], trashed: bool,
            text: Optional[str], resource: Optional[Dict[str, object]], name: Optional[str],
            activity: Activity) -> None:
        super().__init__(id, app)
        Editable.__init__(self, authors, activity)
        Trashable.__init__(self, trashed, activity)
        WithContent.__init__(self, text=text, resource=resource)
        self.name = name
        self.activity = activity
        self.activity.host = self

    async def do_edit(self, **attrs: object) -> None:
        attrs = await WithContent.pre_edit(self, attrs)
        WithContent.do_edit(self, **attrs)
        if 'name' in attrs:
            self.name = expect_opt_type(str)(attrs['name'])

    def json(self, restricted=False, include=False):
        return {
            **super().json(restricted, include),
            **Editable.json(self, restricted, include),
            **Trashable.json(self, restricted, include),
            'name': self.name,
            'activity': self.activity.json(restricted)
        }
