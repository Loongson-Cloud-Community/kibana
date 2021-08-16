/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0 and the Server Side Public License, v 1; you may not use this file except
 * in compliance with, at your election, the Elastic License 2.0 or the Server
 * Side Public License, v 1.
 */

import { Buffer } from 'buffer';
import { stringify } from 'querystring';
import { ApiError, Client, RequestEvent, errors } from '@elastic/elasticsearch';
import type { RequestBody } from '@elastic/elasticsearch/lib/Transport';
import { Logger } from '../../logging';
import { parseClientOptions, ElasticsearchClientConfig } from './client_config';

export const configureClient = (
  config: ElasticsearchClientConfig,
  { logger, type, scoped = false }: { logger: Logger; type: string; scoped?: boolean }
): Client => {
  const clientOptions = parseClientOptions(config, scoped);

  const client = new Client(clientOptions);
  addLogging(client, logger.get('query', type));

  // ------------------------------------------------------------------------ //
  // Hack to disable the "Product check" while the bugs in                    //
  // https://github.com/elastic/kibana/issues/105557 are handled.             //
  skipProductCheck(client);
  // ------------------------------------------------------------------------ //

  return client;
};

const convertQueryString = (qs: string | Record<string, any> | undefined): string => {
  if (qs === undefined || typeof qs === 'string') {
    return qs ?? '';
  }
  return stringify(qs);
};

function ensureString(body: RequestBody): string {
  if (typeof body === 'string') return body;
  if (Buffer.isBuffer(body)) return '[buffer]';
  if ('readable' in body && body.readable && typeof body._read === 'function') return '[stream]';
  return JSON.stringify(body);
}

/**
 * Returns a debug message from an Elasticsearch error in the following format:
 * [error type] error reason
 */
export function getErrorMessage(error: ApiError): string {
  if (error instanceof errors.ResponseError) {
    return `[${error.meta.body?.error?.type}]: ${error.meta.body?.error?.reason ?? error.message}`;
  }
  return `[${error.name}]: ${error.message}`;
}

/**
 * returns a string in format:
 *
 * status code
 * method URL
 * request body
 *
 * so it could be copy-pasted into the Dev console
 */
function getResponseMessage(event: RequestEvent): string {
  const errorMeta = getRequestDebugMeta(event);
  const body = errorMeta.body ? `\n${errorMeta.body}` : '';
  return `${errorMeta.statusCode}\n${errorMeta.method} ${errorMeta.url}${body}`;
}

/**
 * Returns stringified debug information from an Elasticsearch request event
 * useful for logging in case of an unexpected failure.
 */
export function getRequestDebugMeta(
  event: RequestEvent
): { url: string; body: string; statusCode: number | null; method: string } {
  const params = event.meta.request.params;
  // definition is wrong, `params.querystring` can be either a string or an object
  const querystring = convertQueryString(params.querystring);
  return {
    url: `${params.path}${querystring ? `?${querystring}` : ''}`,
    body: params.body ? `${ensureString(params.body)}` : '',
    method: params.method,
    statusCode: event.statusCode,
  };
}

const addLogging = (client: Client, logger: Logger) => {
  client.on('response', (error, event) => {
    if (event) {
      if (error) {
        if (error instanceof errors.ResponseError) {
          logger.debug(`${getResponseMessage(event)} ${getErrorMessage(error)}`);
        } else {
          logger.debug(getErrorMessage(error));
        }
      } else {
        logger.debug(getResponseMessage(event));
      }
    }
  });
};

/**
 * Hack to skip the Product Check performed by the Elasticsearch-js client.
 * We noticed a couple of bugs that may need to be fixed before taking full
 * advantage of this feature.
 *
 * The bugs are detailed in this issue: https://github.com/elastic/kibana/issues/105557
 *
 * The hack is copied from the test/utils in the elasticsearch-js repo
 * (https://github.com/elastic/elasticsearch-js/blob/master/test/utils/index.js#L45-L56)
 */
function skipProductCheck(client: Client) {
  const tSymbol = Object.getOwnPropertySymbols(client.transport || client).filter(
    (symbol) => symbol.description === 'product check'
  )[0];
  // @ts-expect-error `tSymbol` is missing in the index signature of Transport
  (client.transport || client)[tSymbol] = 2;
}
