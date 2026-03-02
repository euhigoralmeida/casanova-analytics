"use client";

import Link from "next/link";

type Props = {
  platform: string;
  message?: string;
  showWelcome?: boolean;
};

export function EmptyIntegrationState({ platform, message, showWelcome }: Props) {
  const defaultMessage = `${platform} não configurado. Configure a integração nas Configurações para ver dados aqui.`;

  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-gray-300 bg-gray-50 px-6 py-16 text-center">
      {showWelcome && (
        <h2 className="mb-2 text-xl font-semibold text-gray-800">
          Bem-vindo ao FiveP Analytics!
        </h2>
      )}
      <div className="mb-4 rounded-full bg-gray-200 p-4">
        <svg
          className="h-8 w-8 text-gray-400"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={1.5}
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M13.19 8.688a4.5 4.5 0 0 1 1.242 7.244l-4.5 4.5a4.5 4.5 0 0 1-6.364-6.364l1.757-1.757m13.35-.622 1.757-1.757a4.5 4.5 0 0 0-6.364-6.364l-4.5 4.5a4.5 4.5 0 0 0 1.242 7.244"
          />
        </svg>
      </div>
      <p className="mb-6 max-w-md text-sm text-gray-500">
        {message ?? defaultMessage}
      </p>
      <Link
        href="/settings/integrations"
        className="rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-blue-700"
      >
        Configurar Integrações
      </Link>
    </div>
  );
}
