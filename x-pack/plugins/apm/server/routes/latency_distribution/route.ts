/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import * as t from 'io-ts';
import { toNumberRt } from '@kbn/io-ts-utils';
import { termQuery } from '@kbn/observability-plugin/server';
import { QueryDslQueryContainer } from '@elastic/elasticsearch/lib/api/typesWithBodyKey';
import { getOverallLatencyDistribution } from './get_overall_latency_distribution';
import { setupRequest } from '../../lib/helpers/setup_request';
import { getSearchAggregatedTransactions } from '../../lib/helpers/transactions';
import { createApmServerRoute } from '../apm_routes/create_apm_server_route';
import { environmentRt, kueryRt, rangeRt } from '../default_api_types';
import {
  SERVICE_NAME,
  TRANSACTION_NAME,
  TRANSACTION_TYPE,
} from '../../../common/elasticsearch_fieldnames';
import {
  latencyDistributionChartTypeRt,
  LatencyDistributionChartType,
} from '../../../common/latency_distribution_chart_types';

const latencyOverallTransactionDistributionRoute = createApmServerRoute({
  endpoint: 'POST /internal/apm/latency/overall_distribution/transactions',
  params: t.type({
    body: t.intersection([
      t.partial({
        serviceName: t.string,
        transactionName: t.string,
        transactionType: t.string,
        termFilters: t.array(
          t.type({
            fieldName: t.string,
            fieldValue: t.union([t.string, toNumberRt]),
          })
        ),
      }),
      environmentRt,
      kueryRt,
      rangeRt,
      t.type({
        percentileThreshold: toNumberRt,
        chartType: latencyDistributionChartTypeRt,
      }),
    ]),
  }),
  options: { tags: ['access:apm'] },
  handler: async (
    resources
  ): Promise<import('./types').OverallLatencyDistributionResponse> => {
    const setup = await setupRequest(resources);

    const {
      environment,
      kuery,
      serviceName,
      transactionType,
      transactionName,
      start,
      end,
      percentileThreshold,
      termFilters,
      chartType,
    } = resources.params.body;

    // only the transaction latency distribution chart can use metrics data
    const searchAggregatedTransactions =
      chartType === LatencyDistributionChartType.transactionLatency
        ? await getSearchAggregatedTransactions({
            ...setup,
            kuery,
            start,
            end,
          })
        : false;

    return getOverallLatencyDistribution({
      setup,
      chartType,
      environment,
      kuery,
      start,
      end,
      query: {
        bool: {
          filter: [
            ...termQuery(SERVICE_NAME, serviceName),
            ...termQuery(TRANSACTION_TYPE, transactionType),
            ...termQuery(TRANSACTION_NAME, transactionName),
            ...(termFilters?.flatMap(
              (fieldValuePair): QueryDslQueryContainer[] =>
                termQuery(fieldValuePair.fieldName, fieldValuePair.fieldValue)
            ) ?? []),
          ],
        },
      },
      percentileThreshold,
      searchMetrics: searchAggregatedTransactions,
    });
  },
});

export const latencyDistributionRouteRepository =
  latencyOverallTransactionDistributionRoute;
