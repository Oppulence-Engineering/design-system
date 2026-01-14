import type { Meta, StoryObj } from "@storybook/react-vite";
import {
  InlineCitation,
  InlineCitationCard,
  InlineCitationCardBody,
  InlineCitationCardTrigger,
  InlineCitationCarousel,
  InlineCitationCarouselContent,
  InlineCitationCarouselHeader,
  InlineCitationCarouselIndex,
  InlineCitationCarouselItem,
  InlineCitationCarouselNext,
  InlineCitationCarouselPrev,
  InlineCitationQuote,
  InlineCitationSource,
  InlineCitationText,
} from "@oppulence/design-system";

const meta = {
  title: "Molecules/InlineCitation",
  component: InlineCitation,
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],
} satisfies Meta<typeof InlineCitation>;

export default meta;
type Story = StoryObj<typeof meta>;

const sources = [
  {
    title: "Q4 Earnings Call Transcript",
    url: "https://investors.example.com/q4-earnings",
    description: "Executive summary for Q4 performance highlights.",
    quote: "Enterprise contracts expanded ARR by 18% year over year.",
  },
  {
    title: "Market Trends Report",
    url: "https://reports.example.com/market-trends",
    description: "Analyst view on category growth drivers and risk signals.",
    quote: "Spend consolidation is accelerating among mid-market buyers.",
  },
];

export const Default: Story = {
  render: () => (
    <div className="max-w-[520px] text-sm">
      <p>
        Our pipeline reflects stronger enterprise momentum
        <InlineCitation>
          <InlineCitationText> based on fresh Q4 disclosures</InlineCitationText>
          <InlineCitationCard>
            <InlineCitationCardTrigger
              sources={sources.map((source) => source.url)}
            />
            <InlineCitationCardBody>
              <InlineCitationCarousel>
                <InlineCitationCarouselHeader>
                  <InlineCitationCarouselPrev />
                  <InlineCitationCarouselIndex />
                  <InlineCitationCarouselNext />
                </InlineCitationCarouselHeader>
                <InlineCitationCarouselContent>
                  {sources.map((source) => (
                    <InlineCitationCarouselItem key={source.url}>
                      <InlineCitationSource
                        title={source.title}
                        url={source.url}
                        description={source.description}
                      />
                      <InlineCitationQuote>{source.quote}</InlineCitationQuote>
                    </InlineCitationCarouselItem>
                  ))}
                </InlineCitationCarouselContent>
              </InlineCitationCarousel>
            </InlineCitationCardBody>
          </InlineCitationCard>
        </InlineCitation>
        .
      </p>
    </div>
  ),
};
