import React from 'react';
import ReactDOM from 'react-dom/client';
import '../../index.css';
import { installManualVerificationEnvironment, seedManualVerificationStorage } from './mockEnvironment';
import { ManualVerificationApp } from './ManualVerificationApp';
import { getManualVerificationView } from './views';

const params = new URLSearchParams(window.location.search);
const view = getManualVerificationView(params.get('view'));

seedManualVerificationStorage(view);
installManualVerificationEnvironment();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ManualVerificationApp />
  </React.StrictMode>,
);
