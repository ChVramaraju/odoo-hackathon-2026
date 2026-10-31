import React from 'react';
import { Modal, ModalProps } from './Modal';

export { Modal };
export type { ModalProps };

// Compatibility alias for shadcn / Radix naming conventions
export interface DialogProps extends ModalProps {}

export const Dialog: React.FC<DialogProps> = (props) => {
  return <Modal {...props} />;
};

