import {
  getProductSizeGuide,
  type SizeGuideInput,
} from "@/lib/product-size-guide";

function MeasureDrawing({ bottom }: { bottom: boolean }) {
  return (
    <svg
      viewBox="0 0 280 210"
      role="img"
      aria-label={
        bottom
          ? "하의 허리단면·엉덩이단면·총장 측정 위치"
          : "상의 어깨너비·가슴단면·총장 측정 위치"
      }
      className="mx-auto w-full max-w-72 text-fg-muted"
    >
      <defs>
        <marker
          id={bottom ? "bottom-arrow" : "top-arrow"}
          viewBox="0 0 10 10"
          refX="5"
          refY="5"
          markerWidth="5"
          markerHeight="5"
          orient="auto-start-reverse"
        >
          <path d="M0 0 10 5 0 10z" fill="currentColor" />
        </marker>
      </defs>
      {bottom ? (
        <path
          d="M83 25H197L205 183H153L140 89L127 183H75Z"
          fill="#eef0f2"
          stroke="currentColor"
          strokeWidth="1.5"
        />
      ) : (
        <path
          d="M103 25L82 33L40 68L68 99L89 83V182H191V83L212 99L240 68L198 33L177 25Q140 52 103 25Z"
          fill="#eef0f2"
          stroke="currentColor"
          strokeWidth="1.5"
        />
      )}
      <g
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        markerStart={`url(#${bottom ? "bottom-arrow" : "top-arrow"})`}
        markerEnd={`url(#${bottom ? "bottom-arrow" : "top-arrow"})`}
      >
        <path d={bottom ? "M87 37H193" : "M86 47H194"} />
        <path d={bottom ? "M82 76H198" : "M95 105H185"} />
        <path d={bottom ? "M220 30V180" : "M25 34V180"} />
      </g>
      <g fill="currentColor" fontSize="11" textAnchor="middle">
        <text x="140" y={bottom ? "19" : "15"}>
          {bottom ? "A 허리단면" : "A 어깨너비"}
        </text>
        <text x="140" y={bottom ? "96" : "126"}>
          {bottom ? "B 엉덩이단면" : "B 가슴단면"}
        </text>
        <text x={bottom ? "240" : "23"} y="199">
          C 총장
        </text>
      </g>
    </svg>
  );
}

export function ProductSizeGuide(props: SizeGuideInput) {
  const guide = getProductSizeGuide(props);
  return (
    <section
      id="size-guide"
      aria-labelledby="size-guide-title"
      className="min-w-0 scroll-mt-24 space-y-5 border-t border-line pt-8"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="size-guide-title" className="text-xl font-bold">
          사이즈 안내
        </h2>
        <span className="rounded border border-line px-3 py-1 text-xs font-semibold text-fg-muted">
          참고용 · 상품 실측 아님
        </span>
      </div>
      <p className="text-sm leading-6 text-fg-muted">
        {props.name ? `${props.name}의 ` : ""}선택 가능한 옵션을 비교해 보세요.
        정확한 제품 치수는 상품 라벨 또는 고객센터에서 확인할 수 있습니다.
      </p>
      <div
        className={`grid min-w-0 gap-6 ${["top", "bottom", "waist"].includes(guide.kind) ? "md:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]" : ""}`}
      >
        {["top", "bottom", "waist"].includes(guide.kind) && (
          <div className="rounded-md bg-raised p-3">
            <MeasureDrawing bottom={guide.kind !== "top"} />
            <p className="text-center text-xs text-fg-subtle">
              측정 위치를 설명하는 그림입니다.
            </p>
          </div>
        )}
        <div className="min-w-0 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-semibold">{guide.title}</h3>
            {guide.unit && (
              <span className="text-xs text-fg-subtle">{guide.unit}</span>
            )}
          </div>
          <table className="w-full table-fixed border-collapse text-center text-xs sm:text-sm">
            <caption className="sr-only">
              {guide.title} — 상품 실측이 아닌 참고용 안내
            </caption>
            <thead>
              <tr className="border-y border-line bg-raised">
                {guide.columns.map((column) => (
                  <th
                    key={column}
                    scope="col"
                    className="px-1 py-3 font-medium leading-5 [overflow-wrap:anywhere]"
                  >
                    {column}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {guide.rows.map((row) => (
                <tr key={row[0]} className="border-b border-line">
                  {row.map((value, i) => (
                    <td
                      key={i}
                      className={`break-words px-1 py-3 leading-5 ${i === 0 ? "font-semibold" : "text-fg-muted"}`}
                    >
                      {value}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          <p className="rounded-md bg-raised p-3 text-xs leading-6 text-fg-muted">
            {guide.note}
          </p>
        </div>
      </div>
      {guide.measures.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold">
            집에 있는 옷과 비교하는 방법
          </h3>
          <ul className="grid gap-2 text-xs leading-6 text-fg-muted sm:grid-cols-3">
            {guide.measures.map((measure) => (
              <li key={measure}>{measure}</li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
