/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import { kea, MakeLogicType } from 'kea';

import { ErrorCode } from '../../../../../../common/types/error_codes';

import { generateEncodedPath } from '../../../../app_search/utils/encode_path_params';

import { Actions } from '../../../../shared/api_logic/create_api_logic';
import { flashAPIErrors } from '../../../../shared/flash_messages';
import { KibanaLogic } from '../../../../shared/kibana';
import {
  AddConnectorPackageApiLogic,
  AddConnectorPackageApiLogicArgs,
  AddConnectorPackageApiLogicResponse,
} from '../../../api/connector_package/add_connector_package_api_logic';
import { SEARCH_INDEX_TAB_PATH } from '../../../routes';
import { SearchIndexTabId } from '../../search_index/search_index';

type AddConnectorActions = Pick<
  Actions<AddConnectorPackageApiLogicArgs, AddConnectorPackageApiLogicResponse>,
  'apiError' | 'apiSuccess' | 'makeRequest'
> & {
  setIsModalVisible: (isModalVisible: boolean) => { isModalVisible: boolean };
};

export interface AddConnectorValues {
  isModalVisible: boolean;
}

export const AddConnectorPackageLogic = kea<MakeLogicType<AddConnectorValues, AddConnectorActions>>(
  {
    actions: {
      setIsModalVisible: (isModalVisible: boolean) => ({ isModalVisible }),
    },
    connect: {
      actions: [AddConnectorPackageApiLogic, ['apiError', 'apiSuccess']],
    },
    listeners: {
      apiError: (error) => flashAPIErrors(error),
      apiSuccess: async ({ indexName }, breakpoint) => {
        // Give Elasticsearch the chance to propagate the index so we don't end up in an error state after navigating
        await breakpoint(1000);
        KibanaLogic.values.navigateToUrl(
          generateEncodedPath(SEARCH_INDEX_TAB_PATH, {
            indexName,
            tabId: SearchIndexTabId.CONFIGURATION,
          })
        );
      },
    },
    path: ['enterprise_search', 'add_connector'],
    reducers: {
      isModalVisible: [
        false,
        {
          apiError: (_, error) =>
            error.body?.attributes?.error_code === ErrorCode.CONNECTOR_DOCUMENT_ALREADY_EXISTS,
          apiSuccess: () => false,
          setIsModalVisible: (_, { isModalVisible }) => isModalVisible,
        },
      ],
    },
  }
);
