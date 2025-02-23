/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import { IHttpFetchError } from '@kbn/core-http-browser';
import { PayloadAction } from '@reduxjs/toolkit';
import { call, put, takeLeading } from 'redux-saga/effects';
import { fetchEffectFactory } from '../utils/fetch_effect';
import {
  fetchMonitorListAction,
  fetchUpsertFailureAction,
  fetchUpsertMonitorAction,
  fetchUpsertSuccessAction,
  UpsertMonitorRequest,
} from './actions';
import { fetchMonitorManagementList, fetchUpsertMonitor } from './api';

export function* fetchMonitorListEffect() {
  yield takeLeading(
    fetchMonitorListAction.get,
    fetchEffectFactory(
      fetchMonitorManagementList,
      fetchMonitorListAction.success,
      fetchMonitorListAction.fail
    )
  );
}

export function* upsertMonitorEffect() {
  yield takeLeading(
    fetchUpsertMonitorAction,
    function* (action: PayloadAction<UpsertMonitorRequest>): Generator {
      try {
        const response = yield call(fetchUpsertMonitor, action.payload);
        yield put(
          fetchUpsertSuccessAction(response as { id: string; attributes: { enabled: boolean } })
        );
      } catch (error) {
        yield put(
          fetchUpsertFailureAction({ id: action.payload.id, error: error as IHttpFetchError })
        );
      }
    }
  );
}
