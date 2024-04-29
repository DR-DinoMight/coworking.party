import humanizeDuration from 'humanize-duration';
import type * as Party from 'partykit/server';
import { z } from 'zod';
import { fromError } from 'zod-validation-error';

import { getUserDataByApiKey } from '@/db/queries';
import { userPublicDataSchema } from '@/lib/types';
import { getErrorMessage } from '@/lib/utils';

import { UserList } from '@/party/userList';

const taglineUpdateSchema = z.object({
  apiKey: z.string().min(1),
  tagline: z.string().min(1).max(120),
});

type parseApiRequestParams = {
  request: Party.Request;
  users: UserList;
};
export async function parseApiRequest({ request, users }: parseApiRequestParams) {
  try {
    const { method, url } = request;
    const path = new URL(url).pathname.replace('/party/main', '');

    if (method === 'GET' && path === '/users') {
      return new Response(
        JSON.stringify({ users: users.list.map((user) => userPublicDataSchema.parse(user)) })
      );
    }

    if (method === 'POST' && path === '/tagline') {
      return await taglineUpdate({ request, users });
    }

    if (method === 'GET' && path === '/debug') {
      return debugInfo();
    }

    return new Response(null, { status: 405 });
  } catch (err) {
    return new Response(JSON.stringify({ status: 'error', message: getErrorMessage(err) }), {
      status: 500,
    });
  }
}

const startTime = Date.now();

type TaglineUpdateParams = {
  request: Party.Request;
  users: UserList;
};
export async function taglineUpdate({ request, users }: TaglineUpdateParams) {
  try {
    const result = taglineUpdateSchema.safeParse(await request.json());

    if (!result.success)
      return new Response(
        JSON.stringify({
          status: 'error',
          message: `Invalid request: ${fromError(result.error)}}`,
        }),
        {
          status: 400,
        }
      );

    const [user] = await getUserDataByApiKey(result.data.apiKey);
    if (!user) {
      return new Response(JSON.stringify({ status: 'error', message: 'User/API key not found' }), {
        status: 404,
      });
    }

    const { wasConnected } = await users.updateUserData({
      data: { tagline: result.data.tagline },
      userId: user.userId,
    });

    return new Response(JSON.stringify({ status: `success`, wasConnected }, null, 2), {
      status: 200,
    });
  } catch (err) {
    return new Response(
      JSON.stringify({ status: 'error', message: `Error: ${getErrorMessage(err)}` }),
      { status: 500 }
    );
  }
}

export function debugInfo() {
  const debugData = {
    dbUrl: process.env.DATABASE_URL?.slice(0, 15) + '...',
    dbAuth: '...' + process.env.DATABASE_AUTH_TOKEN?.slice(-5),
    uptime: humanizeDuration(Date.now() - startTime, { round: true }),
    startTime: new Date(startTime).toISOString(),
  };

  return new Response(JSON.stringify(debugData, null, 2), { status: 200 });
}
