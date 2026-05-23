import { Route, Routes } from 'react-router-dom';

import { EditorPage } from '@/ui/pages/editor/EditorPage';
import { HomePage } from '@/ui/pages/home/HomePage';

export function RouterContent() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/editor/:folderName" element={<EditorPage />} />
    </Routes>
  );
}
