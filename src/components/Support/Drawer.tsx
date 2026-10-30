import React, { useState } from 'react';
import { TicketDrawer } from './TicketDrawer';

/**
 * Generic sliding drawer wrapper used by the Support module.
 * It can be toggled open/close from any parent component.
 */
export const SupportDrawer: React.FC = () => {
  const [open, setOpen] = useState(false);

  const toggle = () => setOpen(!open);

  return (
    <>
      {/* Help icon – could be moved to a header component */}
      <button className="support-help-icon" onClick={toggle} aria-label="Help">
        ❔
      </button>
      {open && (
        <div className="support-drawer overlay">
          <button className="close-btn" onClick={toggle} aria-label="Close">
            ✕
          </button>
          <TicketDrawer />
        </div>
      )}
    </>
  );
};

