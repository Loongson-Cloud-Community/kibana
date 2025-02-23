/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import { EuiSwitch, EuiSwitchEvent, EuiLoadingSpinner } from '@elastic/eui';
import React, { useMemo } from 'react';
import { FETCH_STATUS } from '@kbn/observability-plugin/public';
import { useCanEditSynthetics } from '../../../../../../hooks/use_capabilities';
import { ConfigKey, EncryptedSyntheticsMonitor } from '../../../../../../../common/runtime_types';
import * as labels from './labels';
import { useMonitorEnableHandler } from '../../../../hooks/use_monitor_enable_handler';

interface Props {
  id: string;
  monitor: EncryptedSyntheticsMonitor;
  reloadPage: () => void;
  initialLoading?: boolean;
}

export const MonitorEnabled = ({ id, monitor, reloadPage, initialLoading }: Props) => {
  const isDisabled = !useCanEditSynthetics();

  const monitorName = monitor[ConfigKey.NAME];
  const statusLabels = useMemo(() => {
    return {
      failureLabel: labels.getMonitorEnabledUpdateFailureMessage(monitorName),
      enabledSuccessLabel: labels.getMonitorEnabledSuccessLabel(monitorName),
      disabledSuccessLabel: labels.getMonitorDisabledSuccessLabel(monitorName),
    };
  }, [monitorName]);

  const { isEnabled, updateMonitorEnabledState, status } = useMonitorEnableHandler({
    id,
    reloadPage,
    labels: statusLabels,
  });

  const enabled = isEnabled ?? monitor[ConfigKey.ENABLED];
  const isLoading = status === FETCH_STATUS.LOADING;

  const handleEnabledChange = (event: EuiSwitchEvent) => {
    const checked = event.target.checked;
    updateMonitorEnabledState(monitor, checked);
  };

  return (
    <>
      {isLoading || initialLoading ? (
        <EuiLoadingSpinner size="m" />
      ) : (
        <EuiSwitch
          compressed={true}
          checked={enabled}
          disabled={isLoading || isDisabled}
          showLabel={false}
          label={enabled ? labels.DISABLE_MONITOR_LABEL : labels.ENABLE_MONITOR_LABEL}
          title={enabled ? labels.DISABLE_MONITOR_LABEL : labels.ENABLE_MONITOR_LABEL}
          data-test-subj="syntheticsIsMonitorEnabled"
          onChange={handleEnabledChange}
        />
      )}
    </>
  );
};
