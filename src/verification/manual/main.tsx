import React from 'react';
import { createRoot } from 'react-dom/profiling';
import '../../index.css';
import { installManualVerificationEnvironment, seedManualVerificationStorage } from './mockEnvironment';
import { ManualVerificationApp } from './ManualVerificationApp';
import { getManualVerificationView } from './views';

const params = new URLSearchParams(window.location.search);
const view = getManualVerificationView(params.get('view'));

seedManualVerificationStorage(view);
installManualVerificationEnvironment();

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ManualVerificationApp />
  </React.StrictMode>,
);
