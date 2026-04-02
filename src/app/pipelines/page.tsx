'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function PipelinesRootPage() {
  const router = useRouter();
  
  useEffect(() => {
    router.replace('/pipelines/manage');
  }, [router]);
  
  return null;
}
