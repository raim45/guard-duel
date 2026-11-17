import { AppToaster } from './components/ui';
import { Styleguide } from './styleguide/Styleguide';

/** Phases D0 and D1 have one route only: /styleguide. Real routing arrives with the D4 screens. */
export function App() {
  return (
    <>
      <Styleguide />
      <AppToaster />
    </>
  );
}
