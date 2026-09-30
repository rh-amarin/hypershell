import { Label, type LabelProps } from "@patternfly/react-core";
import {
  CheckCircleIcon,
  ExclamationCircleIcon,
  ExclamationTriangleIcon,
  QuestionCircleIcon,
  WrenchIcon,
} from "@patternfly/react-icons";
import type { ReactElement } from "react";
import { useIntl, type MessageDescriptor } from "react-intl";

import type { ServiceStatus } from "../domain/home-content";
import { messages } from "./messages";

interface StatusPresentation {
  readonly color?: LabelProps["color"];
  readonly icon: ReactElement;
  readonly label: MessageDescriptor;
  readonly status?: LabelProps["status"];
}

// Mapping follows specs/standards/ui/brand-color.spec.md: success-green,
// orange for caution, danger-orange for failure, teal for neutral
// information, and gray for anything unknown. Red is never a status.
export const statusPresentation: Record<ServiceStatus, StatusPresentation> = {
  degraded: {
    color: "orange",
    icon: <ExclamationTriangleIcon />,
    label: messages.statusDegraded,
  },
  maintenance: {
    color: "teal",
    icon: <WrenchIcon />,
    label: messages.statusMaintenance,
  },
  operational: {
    icon: <CheckCircleIcon />,
    label: messages.statusOperational,
    status: "success",
  },
  outage: {
    icon: <ExclamationCircleIcon />,
    label: messages.statusOutage,
    status: "danger",
  },
  unknown: {
    color: "grey",
    icon: <QuestionCircleIcon />,
    label: messages.statusUnknown,
  },
};

export interface StatusLabelProps {
  readonly status: ServiceStatus;
}

/** A status that always pairs its color with text and an icon. */
export function StatusLabel({ status }: StatusLabelProps) {
  const intl = useIntl();
  const presentation = statusPresentation[status];
  return (
    <Label
      color={presentation.color}
      data-status={status}
      icon={presentation.icon}
      isCompact
      status={presentation.status}
    >
      {intl.formatMessage(presentation.label)}
    </Label>
  );
}
