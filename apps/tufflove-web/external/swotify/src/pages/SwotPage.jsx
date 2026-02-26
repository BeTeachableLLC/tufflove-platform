import React, { useState, useRef, useEffect } from 'react';
import "../Swot.css";
import jsPDF from 'jspdf';
import 'jspdf-autotable';

const swotData = {
  swotQuestions: [
    {
      "section": "Strengths",
      'mobile': 'S',
      "questions": [
        {
          "id": 1,
          "question": "Patents?",
          "options": [
            {
              "text": "Yes",
              "result": "Patents provide legal protection, prevent imitation, and attract investors, strengthening market position."
            },
            {
              "text": "No",
              "result": "Without patents,∆w your business is vulnerable to imitation. Explore trade secrets or consider patent registration."
            }
          ]
        },
        {
          "id": 2,
          "question": "Strong brand name?",
          "options": [
            {
              "text": "Yes",
              "result": "A strong brand builds trust, loyalty, and recognition, enhancing market presence and reducing costs."
            },
            {
              "text": "No",
              "result": "Lack of a strong brand hinders visibility. Invest in branding to boost awareness and customer loyalty."
            }
          ]
        },
        {
          "id": 3,
          "question": "Good reputation among customers?",
          "options": [
            {
              "text": "Yes",
              "result": "A good reputation drives loyalty, referrals, and retention, enhancing long-term business success."
            },
            {
              "text": "No",
              "result": "A weak reputation affects growth. Focus on customer satisfaction to rebuild trust and loyalty."
            }
          ]
        },
        {
          "id": 4,
          "question": "Many product lines?",
          "options": [
            {
              "text": "Yes",
              "result": "Diverse product lines reduce risks and attract more customers, boosting revenue potential."
            },
            {
              "text": "No",
              "result": "Limited products restrict growth. Explore market gaps to diversify offerings and revenue streams."
            }
          ]
        },
        {
          "id": 5,
          "question": "Broad market coverage?",
          "options": [
            {
              "text": "Yes",
              "result": "Broad coverage improves visibility, resilience, and sales across diverse markets."
            },
            {
              "text": "No",
              "result": "Limited coverage reduces revenue potential. Expand strategically to new regions or segments."
            }
          ]
        },
        {
          "id": 6,
          "question": "Manufacturing competence?",
          "options": [
            {
              "text": "Yes",
              "result": "Efficient manufacturing improves quality, reduces costs, and enhances scalability."
            },
            {
              "text": "No",
              "result": "Inefficiencies affect quality and cost. Optimize processes or consider outsourcing for improvements."
            }
          ]
        },
        {
          "id": 7,
          "question": "Good marketing skills?",
          "options": [
            {
              "text": "Yes",
              "result": "Effective marketing increases visibility, customer engagement, and sales."
            },
            {
              "text": "No",
              "result": "Weak marketing limits growth. Invest in skills and tools to reach and retain customers."
            }
          ]
        },
        {
          "id": 8,
          "question": "Ability to attract talented managers?",
          "options": [
            {
              "text": "Yes",
              "result": "Attracting skilled managers strengthens leadership and drives operational excellence."
            },
            {
              "text": "No",
              "result": "Lacking talent limits growth. Enhance employer branding and offer competitive incentives."
            }
          ]
        },
        {
          "id": 9,
          "question": "Ability to motivate employees?",
          "options": [
            {
              "text": "Yes",
              "result": "Motivated employees boost productivity and contribute to organizational success."
            },
            {
              "text": "No",
              "result": "Low morale affects performance. Recognize achievements and foster growth to improve motivation."
            }
          ]
        },
        {
          "id": 10,
          "question": "Ability to innovate?",
          "options": [
            {
              "text": "Yes",
              "result": "Innovation keeps your business competitive and aligned with market trends."
            },
            {
              "text": "No",
              "result": "Lack of innovation risks obsolescence. Foster creativity and invest in R&D to adapt."
            }
          ]
        },
        {
          "id": 11,
          "question": "Clear understanding of customer needs?",
          "options": [
            {
              "text": "Yes",
              "result": "Understanding customer needs helps tailor products and services, increasing satisfaction and loyalty."
            },
            {
              "text": "No",
              "result": "Lack of insight into customer needs can lead to mismatched offerings. Invest in customer research and feedback."
            }
          ]
        },
        {
          "id": 12,
          "question": "Ability to innovate?",
          "options": [
            {
              "text": "Yes",
              "result": "Innovation drives growth, differentiating your business and positioning you as an industry leader."
            },
            {
              "text": "No",
              "result": "Lack of innovation results in stagnation. Foster creativity to stay competitive and meet changing demands."
            }
          ]
        },
        {
          "id": 13,
          "question": "Effective customer support?",
          "options": [
            {
              "text": "Yes",
              "result": "Exceptional support enhances customer loyalty, reduces churn, and improves brand reputation."
            },
            {
              "text": "No",
              "result": "Poor support leads to dissatisfaction and loss of customers. Invest in responsive and helpful support systems."
            }
          ]
        },
        {
          "id": 14,
          "question": "Strong employee satisfaction?",
          "options": [
            {
              "text": "Yes",
              "result": "Happy employees are more productive and motivated, directly contributing to business success."
            },
            {
              "text": "No",
              "result": "Low satisfaction impacts performance. Focus on employee engagement and welfare to boost morale."
            }
          ]
        },
        {
          "id": 15,
          "question": "Clear brand identity?",
          "options": [
            {
              "text": "Yes",
              "result": "A strong brand identity attracts customers, builds loyalty, and positions you effectively in the market."
            },
            {
              "text": "No",
              "result": "An unclear brand confuses customers. Define your brand values, vision, and messaging for better recognition."
            }
          ]
        },
        {
          "id": 16,
          "question": "Access to capital?",
          "options": [
            {
              "text": "Yes",
              "result": "Easier access to capital supports growth, investment in new opportunities, and financial stability."
            },
            {
              "text": "No",
              "result": "Limited capital restricts growth. Improve financial planning and explore new funding sources."
            }
          ]
        },
        {
          "id": 17,
          "question": "Efficient supply chain?",
          "options": [
            {
              "text": "Yes",
              "result": "A streamlined supply chain reduces costs, improves product availability, and enhances customer satisfaction."
            },
            {
              "text": "No",
              "result": "Inefficiencies in the supply chain lead to delays and higher costs. Optimize your logistics to stay competitive."
            }
          ]
        },
        {
          "id": 18,
          "question": "Appropriate control systems?",
          "options": [
            {
              "text": "Yes",
              "result": "Strong control systems ensure accountability, minimize risks, and improve decision-making through real-time data."
            },
            {
              "text": "No",
              "result": "Weak controls expose risks and inefficiencies. Implement robust systems to enhance accountability and compliance."
            }
          ]
        },
        {
          "id": 19,
          "question": "Ability to manage strategic change?",
          "options": [
            {
              "text": "Yes",
              "result": "Your adaptability ensures smooth transitions, fostering innovation and maintaining competitive focus."
            },
            {
              "text": "No",
              "result": "Struggles with change hinder competitiveness. Build capabilities to adapt and seize new opportunities."
            }
          ]
        },
        {
          "id": 20,
          "question": "Well-developed corporate strategy?",
          "options": [
            {
              "text": "Yes",
              "result": "A clear strategy aligns goals, optimizes resources, and drives long-term growth."
            },
            {
              "text": "No",
              "result": "Lack of strategy causes inefficiencies. Develop a plan to align efforts and drive success."
            }
          ]
        },
        {
          "id": 21,
          "question": "Good international operations?",
          "options": [
            {
              "text": "Yes",
              "result": "Strong international operations diversify revenue and boost global presence."
            },
            {
              "text": "No",
              "result": "Limited global reach restricts growth. Expand internationally for resilience and new opportunities."
            }
          ]
        },
        {
          "id": 22,
          "question": "Able to profit during pandemics?",
          "options": [
            {
              "text": "Yes",
              "result": "Resilient operations maintain profitability during crises, enhancing trust and brand strength."
            },
            {
              "text": "No",
              "result": "Pandemic struggles highlight vulnerabilities. Build resilience to handle future disruptions."
            }
          ]
        }
      ]
    },
    {
      "section": "Weaknesses",
      'mobile': 'W',
      "questions": [
        {
          "id": 1,
          "question": "Obsolete, narrow product lines?",
          "options": [
            {
              "text": "Yes",
              "result": "Limited product variety can reduce your business's market appeal and hinder revenue growth. Expanding or updating your product lines can attract new customers and meet evolving consumer demands."
            },
            {
              "text": "No",
              "result": "Your product lines are well-diversified and relevant to market demands, ensuring strong customer appeal and sustained revenue streams."
            }
          ]
        },
        {
          "id": 2,
          "question": "Prone to loss during pandemics?",
          "options": [
            {
              "text": "Yes",
              "result": "Lack of crisis resilience can lead to significant financial losses and operational disruptions during pandemics. Developing contingency plans and diversifying income sources can mitigate risks."
            },
            {
              "text": "No",
              "result": "Your business model is adaptable to challenges like pandemics, ensuring continued operations and financial stability during crises."
            }
          ]
        },
        {
          "id": 3,
          "question": "Rising manufacturing costs?",
          "options": [
            {
              "text": "Yes",
              "result": "Increased manufacturing costs can squeeze profit margins and reduce pricing competitiveness. Streamlining processes or sourcing more affordable materials can improve cost efficiency."
            },
            {
              "text": "No",
              "result": "Your manufacturing costs are well-controlled, contributing to profitability and pricing competitiveness in the market."
            }
          ]
        },
        {
          "id": 4,
          "question": "Decline in R&D innovations?",
          "options": [
            {
              "text": "Yes",
              "result": "Limited innovation efforts can hinder growth and make your business less competitive. Strengthening your R&D investments will foster innovation and market leadership."
            },
            {
              "text": "No",
              "result": "Your R&D initiatives are actively driving innovation, keeping your business ahead of market trends."
            }
          ]
        },
        {
          "id": 5,
          "question": "Poor marketing skills?",
          "options": [
            {
              "text": "Yes",
              "result": "Weak marketing strategies can limit brand visibility and hinder customer acquisition efforts. Improving marketing capabilities will enhance your competitive position."
            },
            {
              "text": "No",
              "result": "Your marketing strategies effectively attract and retain customers, fostering brand growth and market presence."
            }
          ]
        },
        {
          "id": 6,
          "question": "Poor materials management systems?",
          "options": [
            {
              "text": "Yes",
              "result": "Inefficient materials management can lead to increased waste and higher operational costs. Implementing better inventory controls will enhance efficiency."
            },
            {
              "text": "No",
              "result": "Your materials management systems are efficient, minimizing waste and ensuring smooth operations."
            }
          ]
        },
        {
          "id": 7,
          "question": "Poor reputation?",
          "options": [
            {
              "text": "Yes",
              "result": "A negative reputation can damage customer trust and impact sales. Strengthening public relations and addressing customer concerns can rebuild goodwill."
            },
            {
              "text": "No",
              "result": "Your business enjoys a positive reputation, fostering trust and loyalty among customers and stakeholders."
            }
          ]
        },
        {
          "id": 8,
          "question": "High cost structure?",
          "options": [
            {
              "text": "Yes",
              "result": "High operational costs reduce margins and limit your ability to compete on price. Optimizing processes and exploring cost-saving measures can improve profitability."
            },
            {
              "text": "No",
              "result": "Your cost structure is optimized for profitability, allowing you to maintain competitive pricing."
            }
          ]
        },
        {
          "id": 9,
          "question": "Loss of customer goodwill?",
          "options": [
            {
              "text": "Yes",
              "result": "Losing customer goodwill can increase churn and reduce future sales. Implementing strong customer service strategies can restore trust."
            },
            {
              "text": "No",
              "result": "Your business maintains strong relationships with customers, ensuring loyalty and repeat business."
            }
          ]
        },
        {
          "id": 10,
          "question": "Inadequate information systems?",
          "options": [
            {
              "text": "Yes",
              "result": "Weak IT systems can lead to operational inefficiencies and poor decision-making. Investing in modern technologies will improve business performance."
            },
            {
              "text": "No",
              "result": "Your information systems are effective, ensuring smooth operations and data-driven decision-making."
            }
          ]
        },
        {
          "id": 11,
          "question": "Inadequate human resources?",
          "options": [
            {
              "text": "Yes",
              "result": "Inadequate staffing can impact productivity and performance. Strengthening recruitment and training efforts will ensure your workforce meets business needs."
            },
            {
              "text": "No",
              "result": "Your workforce is well-equipped and capable of meeting current business demands."
            }
          ]
        },
        {
          "id": 12,
          "question": "Lack of access to distribution channels?",
          "options": [
            {
              "text": "Yes",
              "result": "Limited access to distribution channels can restrict market reach. Expanding your distribution network will increase sales opportunities."
            },
            {
              "text": "No",
              "result": "Your business has effective distribution channels, ensuring broad market reach."
            }
          ]
        },
        {
          "id": 13,
          "question": "Lack of access to natural resources?",
          "options": [
            {
              "text": "Yes",
              "result": "Limited resources can impact production and limit growth opportunities. Securing alternative suppliers can mitigate resource constraints."
            },
            {
              "text": "No",
              "result": "Your business has sufficient access to essential natural resources, supporting smooth operations."
            }
          ]
        },
        {
          "id": 14,
          "question": "Loss of brand name capital?",
          "options": [
            {
              "text": "Yes",
              "result": "Losing brand value can affect customer loyalty and engagement. Investing in brand-building efforts will restore brand equity."
            },
            {
              "text": "No",
              "result": "Your brand remains strong and recognizable, maintaining customer trust."
            }
          ]
        },
        {
          "id": 15,
          "question": "Lack of patent protection?",
          "options": [
            {
              "text": "Yes",
              "result": "Lack of patents can expose your products to imitation and reduce competitive advantage. Strengthening IP protection will safeguard your innovations."
            },
            {
              "text": "No",
              "result": "Your patents provide strong intellectual property protection, preventing imitation."
            }
          ]
        },
        {
          "id": 16,
          "question": "Growth without direction?",
          "options": [
            {
              "text": "Yes",
              "result": "Unplanned growth can cause inefficiencies and confusion. Aligning your growth with strategic goals will ensure sustainable expansion."
            },
            {
              "text": "No",
              "result": "Your growth strategy is well-aligned with your business objectives, ensuring smooth expansion."
            }
          ]
        },
        {
          "id": 17,
          "question": "Poor product innovation?",
          "options": [
            {
              "text": "Yes",
              "result": "Weak innovation reduces market relevance and competitiveness. Enhancing product development efforts will drive future growth."
            },
            {
              "text": "No",
              "result": "Your product innovation is a core strength, keeping you competitive in the market."
            }
          ]
        },
        {
          "id": 18,
          "question": "Inconsistent operations?",
          "options": [
            {
              "text": "Yes",
              "result": "Operational inconsistencies can affect performance and quality. Standardizing processes will improve efficiency."
            },
            {
              "text": "No",
              "result": "Your operations are consistent and reliable, ensuring high-quality output."
            }
          ]
        },
        {
          "id": 19,
          "question": "Inadequate organizational structure?",
          "options": [
            {
              "text": "Yes",
              "result": "Poor structure can hinder communication and productivity. Restructuring your organization will enhance efficiency."
            },
            {
              "text": "No",
              "result": "Your organizational structure supports effective communication and operations."
            }
          ]
        },
        {
          "id": 20,
          "question": "Inappropriate control systems?",
          "options": [
            {
              "text": "Yes",
              "result": "Weak controls can increase risks and reduce operational efficiency. Strengthening internal controls will improve risk management."
            },
            {
              "text": "No",
              "result": "Your control systems are robust, ensuring effective risk management."
            }
          ]
        },
        {
          "id": 21,
          "question": "High conflict and politics?",
          "options": [
            {
              "text": "Yes",
              "result": "Internal conflicts and office politics can lead to a toxic work environment, diminishing team morale and productivity. It's essential to foster a culture of collaboration and open communication to address underlying issues and build a more cohesive team."
            },
            {
              "text": "No",
              "result": "Your organization maintains a positive work environment, characterized by collaboration and mutual respect. This atmosphere promotes high performance and job satisfaction among employees."
            }
          ]
        },
        {
          "id": 22,
          "question": "Is there a lack of leadership or vision?",
          "options": [
            {
              "text": "Yes",
              "result": "A lack of leadership or vision can create uncertainty and hinder progress. Developing a clear vision and strengthening leadership will align teams and drive growth."
            },
            {
              "text": "No",
              "result": "Your leadership provides clear direction, ensuring that your team is aligned with long-term goals and objectives."
            }
          ]
        }
      ]
    },
    {
      "section": "Opportunities",
      'mobile': 'O',
      "questions": [
        {
          "id": 1,
          "question": "Expand core business(es)?",
          "options": [
            {
              "text": "Yes",
              "result": "Expanding core operations can boost revenue and market share. It allows your business to capitalize on existing strengths and meet increased demand."
            },
            {
              "text": "No",
              "result": "Focusing on existing business levels without expansion for now. This can help solidify current operations but may limit growth potential."
            }
          ]
        },
        {
          "id": 2,
          "question": "Exploit new market segments?",
          "options": [
            {
              "text": "Yes",
              "result": "Entering new segments can unlock hidden revenue opportunities, helping diversify the customer base and reduce dependency on current markets."
            },
            {
              "text": "No",
              "result": "Staying focused on current target markets. This approach can strengthen brand loyalty but may overlook potential growth avenues."
            }
          ]
        },
        {
          "id": 3,
          "question": "Arrival of new technologies?",
          "options": [
            {
              "text": "Yes",
              "result": "Leveraging new technologies can drive innovation and efficiency, giving your business a competitive edge and improving operations."
            },
            {
              "text": "No",
              "result": "Current technology solutions are adequate. This conservatism can be beneficial but may risk falling behind industry advancements."
            }
          ]
        },
        {
          "id": 4,
          "question": "Removal of international trade barriers?",
          "options": [
            {
              "text": "Yes",
              "result": "Lower trade barriers can open new export opportunities, enhancing global reach and diversifying revenue streams."
            },
            {
              "text": "No",
              "result": "No significant changes in international trade policies relevant to your business. This stability can allow for consistent planning."
            }
          ]
        },
        {
          "id": 5,
          "question": "Exploit unfulfilled customer needs?",
          "options": [
            {
              "text": "Yes",
              "result": "Meeting unmet needs can increase customer satisfaction and loyalty, positioning your business as a leader in customer-centric solutions."
            },
            {
              "text": "No",
              "result": "Current offerings align well with customer needs. While this indicates stability, it may also suggest a lack of innovation."
            }
          ]
        },
        {
          "id": 6,
          "question": "Widen new market segments?",
          "options": [
            {
              "text": "Yes",
              "result": "Expanding into new segments can boost business growth, leveraging existing capabilities to capture new audiences."
            },
            {
              "text": "No",
              "result": "Current segments provide sufficient opportunities. This conservative approach can reduce risk but may limit growth potential."
            }
          ]
        },
        {
          "id": 7,
          "question": "Extend cost or differentiation advantage?",
          "options": [
            {
              "text": "Yes",
              "result": "Strengthening these advantages improves competitiveness, enabling your business to maintain pricing power and attract more customers."
            },
            {
              "text": "No",
              "result": "Current strategies are effective as they are. This may foster stability, but also risks complacency in a dynamic market."
            }
          ]
        },
        {
          "id": 8,
          "question": "Diversify into new growth businesses?",
          "options": [
            {
              "text": "Yes",
              "result": "Diversification can reduce risk and increase revenue streams, helping to buffer against market volatility."
            },
            {
              "text": "No",
              "result": "Focusing on core business activities for now. This strategy may strengthen your core offerings but could limit growth."
            }
          ]
        },
        {
          "id": 9,
          "question": "Expand into foreign markets?",
          "options": [
            {
              "text": "Yes",
              "result": "International expansion can create new growth avenues, allowing your business to tap into emerging markets and customer bases."
            },
            {
              "text": "No",
              "result": "Staying focused on domestic markets for the moment can help consolidate resources and strengthen local operations."
            }
          ]
        },
        {
          "id": 10,
          "question": "Apply R&D skills in new areas?",
          "options": [
            {
              "text": "Yes",
              "result": "Exploring new areas with R&D can boost innovation, potentially leading to breakthrough products or processes."
            },
            {
              "text": "No",
              "result": "R&D will remain focused on current projects, ensuring existing developments are executed effectively."
            }
          ]
        },
        {
          "id": 11,
          "question": "Enter new related businesses?",
          "options": [
            {
              "text": "Yes",
              "result": "Entering related businesses can increase market synergies, enhancing overall business performance and value."
            },
            {
              "text": "No",
              "result": "Staying focused on existing business operations. This may optimize current resources but could limit potential synergies."
            }
          ]
        },
        {
          "id": 12,
          "question": "Vertically integrate forward?",
          "options": [
            {
              "text": "Yes",
              "result": "Forward integration can enhance control over the distribution process, improving margins and customer relationships."
            },
            {
              "text": "No",
              "result": "Maintaining the current level of control over distribution. This strategy may reduce risks associated with rapid changes."
            }
          ]
        },
        {
          "id": 13,
          "question": "Vertically integrate backward?",
          "options": [
            {
              "text": "Yes",
              "result": "Backward integration can secure key inputs and reduce costs, increasing overall operational efficiency."
            },
            {
              "text": "No",
              "result": "Relying on existing suppliers for now. This may provide flexibility but could expose the business to supply chain vulnerabilities."
            }
          ]
        },
        {
          "id": 14,
          "question": "Integrate corporate portfolio?",
          "options": [
            {
              "text": "Yes",
              "result": "Integration can optimize portfolio performance, allowing for better resource allocation and strategic alignment."
            },
            {
              "text": "No",
              "result": "Current portfolio management practices are sufficient. This indicates stability but may miss opportunities for synergy."
            }
          ]
        },
        {
          "id": 15,
          "question": "Lower barriers to entry?",
          "options": [
            {
              "text": "Yes",
              "result": "Reduced barriers can attract new opportunities, enabling faster market penetration and growth."
            },
            {
              "text": "No",
              "result": "Barriers remain challenging but manageable. This may encourage steady growth but can limit aggressive expansion."
            }
          ]
        },
        {
          "id": 16,
          "question": "Acquire foreign competitors?",
          "options": [
            {
              "text": "Yes",
              "result": "Acquisitions can strengthen market position and reduce competition, enhancing your overall strategic advantage."
            },
            {
              "text": "No",
              "result": "Acquisitions are not a strategic priority at the moment. This can maintain focus but may risk missing market shifts."
            }
          ]
        },
        {
          "id": 17,
          "question": "Increase product innovations?",
          "options": [
            {
              "text": "Yes",
              "result": "More innovations can enhance competitive advantage, attracting customers and improving market share."
            },
            {
              "text": "No",
              "result": "Current products are performing well. This suggests stability but may hinder long-term growth."
            }
          ]
        },
        {
          "id": 18,
          "question": "Seek fast market growth?",
          "options": [
            {
              "text": "Yes",
              "result": "Pursuing rapid growth can increase market share, positioning your business favorably against competitors."
            },
            {
              "text": "No",
              "result": "Focusing on sustainable, steady growth instead. This approach can foster long-term stability but may limit short-term gains."
            }
          ]
        },
        {
          "id": 19,
          "question": "Growth during pandemics?",
          "options": [
            {
              "text": "Yes",
              "result": "Pandemic conditions can present unique growth opportunities, enabling businesses to innovate and adapt to changing needs."
            },
            {
              "text": "No",
              "result": "Focus is on stability rather than growth during pandemics. This cautious approach can protect resources but may overlook potential market shifts."
            }
          ]
        }
      ]
    },
    {
      "section": "Threats",
      'mobile': 'T',
      "questions": [
        {
          "id": 1,
          "question": "Attacks on core business(es)?",
          "options": [
            {
              "text": "Yes",
              "result": "External threats, such as cyberattacks or market disruptions, could significantly disrupt key operations or revenue streams, leading to potential financial losses and reputational damage."
            },
            {
              "text": "No",
              "result": "Core businesses are currently secure, indicating effective risk management strategies and robust security measures in place to protect against potential threats."
            }
          ]
        },
        {
          "id": 2,
          "question": "Pandemics cause business interruption?",
          "options": [
            {
              "text": "Yes",
              "result": "Pandemics could disrupt supply chains and operations, affecting the availability of raw materials, workforce productivity, and overall market demand, leading to significant operational challenges."
            },
            {
              "text": "No",
              "result": "Pandemic-related risks are under control, suggesting that contingency plans and adaptive strategies have been successfully implemented to mitigate potential disruptions."
            }
          ]
        },
        {
          "id": 3,
          "question": "Increases in domestic competition?",
          "options": [
            {
              "text": "Yes",
              "result": "Increased competition can pressure market share and profitability, necessitating innovative strategies and enhanced customer engagement to maintain a competitive edge."
            },
            {
              "text": "No",
              "result": "Competition levels remain stable, allowing for consistent market positioning and the potential for strategic growth without the immediate pressure of aggressive competitors."
            }
          ]
        },
        {
          "id": 4,
          "question": "Shift in consumer tastes?",
          "options": [
            {
              "text": "Yes",
              "result": "Changes in consumer preferences could impact demand, requiring businesses to adapt their product offerings and marketing strategies to align with evolving customer expectations."
            },
            {
              "text": "No",
              "result": "Consumer preferences align with current offerings, indicating a strong understanding of market demands and effective brand positioning."
            }
          ]
        },
        {
          "id": 5,
          "question": "Emergence of substitute products?",
          "options": [
            {
              "text": "Yes",
              "result": "Substitute products could threaten market position, compelling the company to enhance product features, reduce prices, or improve customer service to retain consumer loyalty."
            },
            {
              "text": "No",
              "result": "Current products have a strong market presence, reflecting brand strength and customer trust that protect against potential substitution."
            }
          ]
        },
        {
          "id": 6,
          "question": "New regulations?",
          "options": [
            {
              "text": "Yes",
              "result": "New regulations could increase compliance costs, necessitating adjustments to operations, potential fines, and resource allocation to meet new standards."
            },
            {
              "text": "No",
              "result": "Current regulations are manageable, suggesting a well-prepared compliance framework that minimizes operational disruptions."
            }
          ]
        },
        {
          "id": 7,
          "question": "Increased trade barriers?",
          "options": [
            {
              "text": "Yes",
              "result": "Trade barriers could limit foreign market access, restricting growth opportunities and necessitating a reevaluation of market strategies."
            },
            {
              "text": "No",
              "result": "Trade barriers remain unchanged, facilitating smoother international operations and potentially enhancing global market opportunities."
            }
          ]
        },
        {
          "id": 8,
          "question": "Increases in foreign competition?",
          "options": [
            {
              "text": "Yes",
              "result": "Foreign competitors could capture market share, prompting the need for strategic differentiation and stronger marketing efforts to sustain a competitive advantage."
            },
            {
              "text": "No",
              "result": "Foreign competition is stable, providing a conducive environment for consistent market operations without the threat of aggressive new entrants."
            }
          ]
        },
        {
          "id": 9,
          "question": "Fall in barriers to entry?",
          "options": [
            {
              "text": "Yes",
              "result": "Easier market entry could attract new competitors, necessitating proactive strategies to defend market position and customer loyalty."
            },
            {
              "text": "No",
              "result": "Barriers to entry remain high, protecting established businesses from new competitors and allowing for continued market dominance."
            }
          ]
        },
        {
          "id": 10,
          "question": "Rise in new or substitute products?",
          "options": [
            {
              "text": "Yes",
              "result": "New products could shift customer demand away, requiring continuous innovation and customer engagement to retain market interest."
            },
            {
              "text": "No",
              "result": "Current offerings maintain strong customer interest, indicating effective brand loyalty and product relevance."
            }
          ]
        },
        {
          "id": 11,
          "question": "Increase in industry rivalry?",
          "options": [
            {
              "text": "Yes",
              "result": "Intensified rivalry could reduce profitability, driving the need for enhanced operational efficiencies and strategic differentiation."
            },
            {
              "text": "No",
              "result": "Industry rivalry remains moderate, allowing for stable profit margins and a focus on growth opportunities."
            }
          ]
        },
        {
          "id": 12,
          "question": "Higher labor costs?",
          "options": [
            {
              "text": "Yes",
              "result": "Rising labor costs could impact profitability, compelling companies to explore automation and efficiency improvements to offset expenses."
            },
            {
              "text": "No",
              "result": "Labor costs remain stable, facilitating predictable budgeting and financial planning."
            }
          ]
        },
        {
          "id": 13,
          "question": "New forms of industry competition?",
          "options": [
            {
              "text": "Yes",
              "result": "Emerging competition could disrupt the market, necessitating rapid adaptation to new business models and customer expectations."
            },
            {
              "text": "No",
              "result": "Current competition landscape remains unchanged, allowing for continued focus on core business strategies."
            }
          ]
        },
        {
          "id": 14,
          "question": "Potential for takeover?",
          "options": [
            {
              "text": "Yes",
              "result": "Takeover threats could destabilize the company, prompting a need for strategic defense mechanisms and stakeholder engagement."
            },
            {
              "text": "No",
              "result": "The company is secure from hostile takeovers, indicating strong governance and shareholder confidence."
            }
          ]
        },
        {
          "id": 15,
          "question": "Susceptible to corporate raiders?",
          "options": [
            {
              "text": "Yes",
              "result": "Corporate raiders could pose governance risks, requiring robust governance practices and strategic communication with stakeholders."
            },
            {
              "text": "No",
              "result": "Corporate raiding risks are minimal, reflecting solid business practices and investor confidence."
            }
          ]
        },
        {
          "id": 16,
          "question": "Changes in demographic factors?",
          "options": [
            {
              "text": "Yes",
              "result": "Demographic shifts could affect demand, necessitating market research and product adjustments to meet changing consumer profiles."
            },
            {
              "text": "No",
              "result": "Demographic trends remain favorable, supporting sustained demand and growth opportunities."
            }
          ]
        },
        {
          "id": 17,
          "question": "Negative economic factors?",
          "options": [
            {
              "text": "Yes",
              "result": "Economic downturns could hurt business performance, prompting the need for contingency planning and cost management strategies."
            },
            {
              "text": "No",
              "result": "Economic conditions are stable, allowing for strategic growth and investment."
            }
          ]
        },
        {
          "id": 18,
          "question": "Increase in political risk?",
          "options": [
            {
              "text": "Yes",
              "result": "Political instability could impact operations, necessitating risk assessments and contingency strategies to mitigate disruptions."
            },
            {
              "text": "No",
              "result": "Political risks are low, providing a stable environment for business operations."
            }
          ]
        },
        {
          "id": 19,
          "question": "Rising labor costs?",
          "options": [
            {
              "text": "Yes",
              "result": "Higher wages could increase operating costs, requiring strategic adjustments to maintain profitability."
            },
            {
              "text": "No",
              "result": "Labor costs remain stable, ensuring predictable financial management and planning."
            }
          ]
        },
        {
          "id": 20,
          "question": "Slow market growth?",
          "options": [
            {
              "text": "Yes",
              "result": "Slow market growth could limit expansion opportunities, necessitating innovative strategies to capture new markets."
            },
            {
              "text": "No",
              "result": "Market growth remains favorable, supporting strategic initiatives and investments in growth opportunities."
            }
          ]
        }
      ]
    }
  ],
}


const SwotPage = () => {
  const [activeTab, setActiveTab] = useState(0); // Current tab index
  const [responses, setResponses] = useState({}); // Store user responses
  const [submitted, setSubmitted] = useState(false); // Check if form is submitted
  const [highlightUnanswered, setHighlightUnanswered] = useState(false); // Track unanswered questions for highlight

  const sectionRef = useRef(null); // Ref to scroll to the top of the section
  const questionContainerRef = useRef(null); // Ref for the container

  // Ensure the results page starts with "Strengths" on submission.
  useEffect(() => {
    if (submitted) setActiveTab(0); // Start with the first section ("Strengths")
  }, [submitted]);

  const handleOptionChange = (section, questionId, optionText) => {
    setResponses((prev) => ({
      ...prev,
      [section]: {
        ...prev[section],
        [questionId]: optionText,
      },
    }));
  };

  // Gradually scroll upwards when an option is selected
  if (sectionRef.current) {
    sectionRef.current.scrollTo({
      top: sectionRef.current.scrollTo + 10, // Adjust this value as needed
      behavior: "smooth",
    });
  }

  // Automatically scroll the container slightly upward
  if (questionContainerRef.current) {
    questionContainerRef.current.scrollBy({
      top: -50, // Adjust to control how much the scroll moves
      behavior: "smooth",
    });
  }

  const isSectionCompleted = (section) => {
    const questions = swotData.swotQuestions.find((q) => q.section === section).questions;
    return questions.every((q) => responses[section]?.[q.id]);
  };

  const handleSubmit = () => {
    const allSectionsCompleted = swotData.swotQuestions.every((section) =>
      isSectionCompleted(section.section)
    );

    if (allSectionsCompleted) {
      setSubmitted(true);
      setActiveTab(0); // Reset to "Strengths" section
      scrollToTop(); // Scroll to the top of the results section
    } else {
      setHighlightUnanswered(true); // Enable highlight for unanswered questions
      alert("Please complete all sections before submitting.");
    }
  };

  const handleNextTab = () => {
    if (activeTab < swotData.swotQuestions.length - 1) {
      setActiveTab(activeTab + 1);
      scrollToTop(); // Scroll to the top of the next section
    }
  };

  const handleNextResultSection = () => {
    if (activeTab < swotData.swotQuestions.length - 1) {
      setActiveTab(activeTab + 1);
      scrollToTop(); // Scroll to the top of the next result section
    }
  };

  const handlePreviousResultSection = () => {
    if (activeTab > 0) {
      setActiveTab(activeTab - 1);
      scrollToTop(); // Scroll to the top of the previous result section
    }
  };

  const handleRetake = () => {
    setResponses({});
    setSubmitted(false);
    setHighlightUnanswered(false); // Reset unanswered question highlight
    setActiveTab(0); // Reset to the first tab
    scrollToTop(); // Scroll to the top
  };

  const scrollToTop = () => {
    sectionRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const renderResults = (section) => {
    const questions = swotData.swotQuestions.find((q) => q.section === section).questions;

    return questions.map(({ id, question, options }) => {
      const userResponse = responses[section]?.[id];
      const result = options.find((opt) => opt.text === userResponse)?.result;
      return (
        <div key={id} className="resultSpace">
          <p className="questTitle" style={{ marginTop: "40px", fontSize: "20px", backgroundColor: "#D3CCF0", padding: "6px", width: "400px", borderRadius: "8px" }}>
            <strong>{question}</strong>
          </p>
          <p style={{ marginBottom: "20px" }}>{result || "No response given."}</p>
        </div>
      );
    });
  };

  // const handleDownloadPdf = () => {
  //   const doc = new jsPDF();

  //   // General font settings
  //   doc.setFont("helvetica", "normal");

  //   // Define styles for SWOT sections
  //   const sectionStyles = {
  //     Strengths: { color: [0, 176, 80] }, // Green
  //     Weaknesses: { color: [255, 0, 0] }, // Red
  //     Opportunities: { color: [0, 112, 192] }, // Blue
  //     Threats: { color: [255, 192, 0] }, // Yellow
  //   };

  //   // Add title
  //   doc.setFontSize(12);
  //   doc.setTextColor(0, 0, 0);
  //   doc.text("Marketing Plan SWOT Analysis", 14, 20);

  //   let currentY = 30; // Start position for the content

  //   // Loop through SWOT sections
  //   swotData.swotQuestions.forEach((section) => {
  //     const { section: sectionTitle, questions } = section;
  //     const { color } = sectionStyles[sectionTitle] || {};

  //     // Add section title
  //     doc.setFontSize(10);
  //     doc.setTextColor(0, 0, 0);
  //     doc.text(`${sectionTitle}`, 10, currentY + 10); // Section name on the left

  //     // Add initial right border with distinct colors
  //     let startY = currentY - 5; // Keep track of the starting Y-coordinate for the border
  //     doc.setFillColor(...color);
  //     doc.rect(200, startY, 5, 270 - startY, "F"); // Initial right border (up to the bottom of the page)

  //     // Add spacing
  //     currentY += 15;

  //     // Render all questions and their responses
  //     questions.forEach((questionObj) => {
  //       const { id, question, options } = questionObj;
  //       const userResponse = responses[sectionTitle]?.[id] || "No response given";
  //       const result = options.find((opt) => opt.text === userResponse)?.result || "No result available";

  //       // Background color for questions and results
  //       doc.setFillColor(...color.map((val) => Math.min(val + 50, 255))); // Lighter shade of the border color
  //       doc.rect(15, currentY - 3, 180, 20, "F"); // Background rectangle

  //       // Add question (bold)
  //       doc.setFontSize(8);
  //       doc.setFont("helvetica", "bold");
  //       const questionText = doc.splitTextToSize(`${question}:`, 160);
  //       doc.text(questionText, 20, currentY);

  //       // Add response (normal font)
  //       doc.setFont("helvetica", "normal");
  //       const responseText = `${userResponse}: ${result}`;
  //       const responseLines = doc.splitTextToSize(responseText, 160);
  //       doc.text(responseLines, 25, currentY + questionText.length * 4);

  //       // Adjust currentY for the next question
  //       currentY += questionText.length * 3 + responseLines.length * 2 + 10;

  //       // Handle page break if content exceeds the page
  //       if (currentY > 270) {
  //         // Draw a continuation border for the remaining section
  //         const remainingHeight = 270 - startY; // Border height on the current page
  //         doc.rect(200, startY, 5, remainingHeight, "F");

  //         // Add a new page
  //         doc.addPage();

  //         // Reset currentY for the new page and continue the border
  //         currentY = 20;
  //         startY = 20; // Reset border start position
  //         doc.rect(200, startY, 5, 270 - startY, "F"); // Continuation border
  //       }
  //     });

  //     // Finalize the section border after all questions
  //     const remainingHeight = currentY - startY; // Remaining height for the current section's border
  //     doc.rect(200, startY, 5, remainingHeight, "F");

  //     // Add spacing between sections
  //     currentY += 5;

  //     // Handle page break after the section if needed
  //     if (currentY > 270) {
  //       doc.addPage();
  //       currentY = 20; // Reset Y for the new page
  //     }
  //   });

  //   // Save the PDF
  //   doc.save("SWOT_Analysis_Results.pdf");
  // };

  const handleDownloadPdf = () => {
    const doc = new jsPDF();

    // Define gradient styles for SWOT sections
    const sectionStyles = {
      Strengths: { colorStart: [205, 165, 0], colorEnd: [255, 145, 0] }, // Orange gradient 
      Weaknesses: { colorStart: [173, 216, 230], colorEnd: [100, 149, 237] }, // Light blue gradient
      Opportunities: { colorStart: [128, 0, 128], colorEnd: [75, 0, 130] }, // Purple gradient
      Threats: { colorStart: [0, 100, 0], colorEnd: [0, 128, 0] }, // Deep green gradient 
    };

    let pageNumber = 1; // Track the current page number

    // Helper function to draw page border
    const drawPageBorder = (doc) => {
      doc.setDrawColor(257, 257, 257); // Black border color
      doc.setLineWidth(1.5); // Border thickness
      // doc.rect(5, 5, 200, 287); // Border dimensions (full page)
      doc.roundedRect(5, 5, 200, 287, 10, 10, "S"); // Rounded border with a radius of 10
    };

    // Helper function to add a soft background
    const addSoftBackground = (doc, color = [22, 0, 57]) => {
      doc.setFillColor(...color);
      doc.rect(0, 0, 210, 297, "F"); // Cover full A4 page with the color
    };

    // Helper function to add a footer
    const addFooter = (doc) => {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.setTextColor(256, 256, 256);
      doc.text("www.beteachable.com", 105, 285, { align: "center" });
      doc.text(`Page ${pageNumber}`, 105, 290, { align: "center" }); // Page number in the center
    };

    // Add title
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.setTextColor(236, 66, 244); // White text

    // Add a background to the first page
    addSoftBackground(doc);
    drawPageBorder(doc); // Add border to the first page

    // Centering "BETEACHABLE" title
    const title1 = "BETEACHABLE";
    const title1Width = doc.getStringUnitWidth(title1) * doc.internal.getFontSize() / doc.internal.scaleFactor;
    const title1X = (210 - title1Width) / 2; // Center horizontally on the A4 page (210mm width)
    doc.text(title1, title1X, 20); // Y position is 20mm

    // Set up for the second title
    doc.setFont("helvetica", "bold");
    doc.setFontSize(46);
    doc.setTextColor(236, 66, 244); // White text

    // Centering "SWOT ANALYSIS" title
    const title2 = "SWOT ANALYSIS";
    const title2Width = doc.getStringUnitWidth(title2) * doc.internal.getFontSize() / doc.internal.scaleFactor;
    const title2X = (210 - title2Width) / 2; // Center horizontally on the A4 page (210mm width)
    doc.text(title2, title2X, 40); // Y position is 40mm



    // Draw 4 larger circles with letters "S", "W", "O", "T"
    const circleRadius = 15; // Increased circle radius
    const circleY = 40; // Y position for circles

    const letters = ['S', 'W', 'O', 'T'];
    const colors = ['#F44336', '#4CAF50', '#FF9800', '#3F51B5']; // Color for each letter

    // Draw circles and add letters inside them
    for (let i = 0; i < 4; i++) {
      const circleX = 30 + i * 50; // Increased space between circles horizontally
      // Draw circle
      doc.setFillColor(colors[i]);
      doc.circle(circleX, circleY + 40, circleRadius, 'F');
      // Add letter inside the circle
      doc.setFont("helvetica", "bold");
      doc.setTextColor(255, 255, 255); // Set text color to white for contrast
      doc.setFontSize(55);
      doc.text(letters[i], circleX - 8.5, circleY + 48); // Adjust positioning inside the circle
    }

    // Define section titles and content
    const sections = [
      { title: 'Strengths', content: `- Attributes that support a company's success and competitiveness.\n- Characteristics that set the company apart from its competitors.` },
      { title: 'Weaknesses', content: `- Characteristics that put the company at a disadvantage compared to others.\n- Negative internal factors that the company needs to address to achieve its objectives.` },
      { title: 'Opportunities', content: `- External factors that the company can leverage to achieve its objectives.\n- Favorable market conditions that the company can capitalize on.` },
      { title: 'Threats', content: `- Unfavorable market conditions that the company needs to address.\n- Negative external factors that can harm the company's growth and success.` }
    ];

    // Set position for the section titles
    let currentY = 100; // Start position for content

    // Draw section titles and content horizontally in a row under each circle
    for (let i = 0; i < sections.length; i++) {
      const section = sections[i];
      const sectionX = 30 + i * 52; // Align text under each circle

      // Add section title
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8);
      doc.text(section.title, sectionX - 15, currentY); // Position section title under each circle

      // Add section content (adjusted to fit horizontally)
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      const contentLines = doc.splitTextToSize(section.content, 30); // Split content to fit
      doc.text(contentLines, sectionX - 15, currentY + 5); // Position content below section title

      currentY = 100; // Increase Y position for the next row of content
    }


    // let currentY = 60; // Start position for the content
    currentY = 190

    // Loop through SWOT sections
    swotData.swotQuestions.forEach((section) => {
      const { section: sectionTitle, questions } = section;
      const { colorStart, colorEnd } = sectionStyles[sectionTitle] || {};

      // Add section title with padding and rounded rectangle
      doc.setDrawColor(0, 0, 0); // Border color
      doc.setLineWidth(0.5);
      doc.setFillColor(...colorStart);
      doc.roundedRect(10, currentY, 190, 20, 10, 10, "FD"); // Rounded rectangle

      doc.setFont("helvetica", "bold");
      doc.setFontSize(18);
      doc.setTextColor(255, 255, 255); // White text
      // doc.text(`${sectionTitle}`, 15, currentY + 13); // Section name inside rounded rectangle
      const sectionText = `${sectionTitle}`;
      // Write the text multiple times with slight shifts
      doc.text(sectionText, 15, currentY + 13);
      doc.text(sectionText, 15.2, currentY + 13);
      doc.text(sectionText, 14.8, currentY + 13);
      doc.text(sectionText, 15, currentY + 13.2);
      doc.text(sectionText, 15, currentY + 12.8);

      // Add spacing for content
      currentY += 25;
      // pageNumber+=1
      // Loop through each question in the section
      // Loop through each question in the section
      questions.forEach((questionObj) => {
        const { id, question, options } = questionObj;
        const userResponse = responses[sectionTitle]?.[id] || "No response given";
        const result = options.find((opt) => opt.text === userResponse)?.result || "No result available";

        // Define the box dimensions
        const boxHeight = 20; // Height for the question and response box
        const boxWidth = 180;
        const boxX = 15;
        const gradientStep = 3; // Increment for gradient effect

        // Define color range for gradient
        const colorRange = {
          r: (colorEnd[0] - colorStart[0]) / (boxWidth / gradientStep),
          g: (colorEnd[1] - colorStart[1]) / (boxWidth / gradientStep),
          b: (colorEnd[2] - colorStart[2]) / (boxWidth / gradientStep),
        };

        // First, draw the rounded border (no fill yet)
        const borderRadius = 80; // Set border radius for the curve
        doc.setDrawColor(256, 256, 256); // Set border color (black)
        doc.setLineWidth(1); // Set border thickness (thinner line)
        doc.roundedRect(boxX, currentY, boxWidth, boxHeight, borderRadius, borderRadius, "S"); // Rounded rectangle for border

        // Now, apply the gradient fill inside the box
        for (let i = 0; i < boxWidth; i += gradientStep) {
          const r = Math.min(colorStart[0] + colorRange.r * (i / gradientStep), 255);
          const g = Math.min(colorStart[1] + colorRange.g * (i / gradientStep), 255);
          const b = Math.min(colorStart[2] + colorRange.b * (i / gradientStep), 255);

          doc.setFillColor(r, g, b);
          doc.rect(boxX + i, currentY, gradientStep, boxHeight, "F");
        }

        // Add question and response text inside the box with white text
        doc.setFontSize(10);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(255, 255, 255); // Set text color to white for the question
        const questionText = doc.splitTextToSize(`${question}:`, boxWidth - 10);
        doc.text(questionText, boxX + 5, currentY + 7);

        doc.setFont("helvetica", "bold");
        const responseText = `${userResponse}: ${result}`;
        const responseLines = doc.splitTextToSize(responseText, boxWidth - 10);
        doc.text(responseLines, boxX + 5, currentY + 12);

        // Adjust currentY for the next question
        currentY += boxHeight + 5;

        // Handle page break if content exceeds the page
        if (currentY > 260) {
          addFooter(doc);
          pageNumber += 1
          doc.addPage();
          addSoftBackground(doc); // Add background to the new page
          drawPageBorder(doc); // Add border to the new page
          currentY = 20; // Reset Y for the new page
        }
      });




      // Add spacing between sections
      currentY += 10;

      // Handle page break after the section if needed
      
    });

    if (currentY > 260) {
      addFooter(doc);
      pageNumber++; // Increment page number
      doc.addPage();
      addSoftBackground(doc); // Add background to the new page
      drawPageBorder(doc); // Add border to the new page
      currentY = 20; // Reset Y for the new page
    }

    // Add footer to the final page
    addFooter(doc);

    // Save the PDF
    doc.save("SWOT_Analysis_Results.pdf");
  };


  // Helper function to add footer
  const addFooter = (doc) => {
    doc.setFontSize(10);
    doc.setTextColor(150, 150, 150);
    doc.text("www.beteachable.com", 105, 285, { align: "center" }); // Centered footer
  };





  const [isMobile, setIsMobile] = useState(false);
  // Update isMobile state based on window size
  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth <= 768); // Adjust breakpoint as needed
    };

    // Initial check and event listener
    handleResize();
    window.addEventListener("resize", handleResize);

    // Cleanup event listener
    return () => window.removeEventListener("resize", handleResize);
  }, []);


  return (
    <div className="container" ref={sectionRef} >
      {!submitted ? (
        <>
          <div className="tabs">
            {/* {swotData.swotQuestions.map((section, index) => (
              <button
                key={section.section}
                className={`tab ${index === activeTab ? "active" : "buttonTab"}`}
                onClick={() => setActiveTab(index)}
              >
                {section.section}
              </button>
            ))} */}
            {isMobile ? (
              <div className="tabs">
                {swotData.swotQuestions.map((section, index) => (
                  <button
                    key={section.section}
                    className={`tab ${index === activeTab ? "active" : "buttonTab"}`}
                    onClick={() => setActiveTab(index)}
                    style={{ fontSize: "25px" }}
                  >
                    {section.mobile}
                  </button>
                ))}
              </div>
            ) : (
              <div className="tabs">
                {swotData.swotQuestions.map((section, index) => (
                  <button
                    key={section.section}
                    className={`tab ${index === activeTab ? "active" : "buttonTab"}`}
                    onClick={() => setActiveTab(index)}
                  >
                    {section.section}
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="questions">
            {swotData.swotQuestions[activeTab].questions.map(({ id, question, options }) => {
              const isUnanswered = highlightUnanswered && !responses[swotData.swotQuestions[activeTab].section]?.[id];
              return (
                <div key={id} className="question">
                  <p className="questionText" style={{
                    marginTop: "40px",
                    fontSize: "20px",
                    backgroundColor: isUnanswered ? "#ffcccc" : "#D3CCF0", // Light red for unanswered
                    padding: "6px",
                    // width: "400px",
                    borderRadius: "8px"
                  }}>
                    <strong>{question}</strong>
                  </p>
                  {options.map((option) => (
                    <label key={option.text}
                      style={{ backgroundColor: "white", color: "black", fontWeight: "Bold", padding: "6px", width: "400px", borderRadius: "8px", borderColor: "red", border: "3px", }}
                    >
                      <input
                        type="radio"
                        name={`question-${id}`}
                        value={option.text}
                        className="optRadio"
                        checked={
                          responses[swotData.swotQuestions[activeTab].section]?.[id] === option.text
                        }
                        onChange={() =>
                          handleOptionChange(
                            swotData.swotQuestions[activeTab].section,
                            id,
                            option.text
                          )
                        }
                      />
                      {option.text}
                    </label>
                  ))}
                </div>
              );
            })}

            {activeTab === swotData.swotQuestions.length - 1 ? (
              <button onClick={handleSubmit} className="sub">
                Submit
              </button>
            ) : (
              <button onClick={handleNextTab} className="next">
                Next
              </button>
            )}
          </div>
        </>
      ) : (
        // <div className="results">
        //   <h2 style={{ color: "#6357a4" }}>
        //     {swotData.swotQuestions[activeTab].section} Results
        //   </h2>
        //   {renderResults(swotData.swotQuestions[activeTab].section)}

        //   <div className="result-navigation">
        //     {activeTab > 0 && (
        //       <button onClick={handlePreviousResultSection} style={{ marginRight: "10px" }} className="previous">
        //         Previous Section
        //       </button>
        //     )}
        //     {activeTab < swotData.swotQuestions.length - 1 ? (
        //       <button onClick={handleNextResultSection} className="next">
        //         Next Result Section
        //       </button>
        //     ) : (
        //       <>
        //         <button onClick={handleRetake} className="retake">
        //           Retake Test
        //         </button>
        //         <button onClick={handleDownloadPdf} className='pdf'>
        //           Download PDF
        //         </button>
        //       </>
        //     )}
        //   </div>
        // </div>
        <div className="results">
          <h2 style={{ color: "#6357a4" }}>SWOT Analysis Results</h2>

          {/* Iterate through all sections and display results in scrollable boxes */}
          {swotData.swotQuestions.map((section, index) => (
            <div
              key={section.section}
              className="section-results-box"
              style={{
                boxShadow: "0 4px 6px rgba(0, 0, 0, 0.1)",
                padding: "20px",
                marginBottom: "30px",
                borderRadius: "10px",
                backgroundColor: "#ffffff",
                maxHeight: "300px", // Set maximum height
                overflowY: "auto",  // Make content scrollable
              }}
            >
              <h3 style={{ color: "#4A47A3", marginBottom: "10px", fontSize: "25px" }}>{section.section}</h3>
              {renderResults(section.section)}
            </div>
          ))}

          {/* Add buttons for retaking the test and downloading the PDF */}
          <div className="result-navigation" style={{ marginTop: "20px" }}>
            <button onClick={handleRetake} className="retake">
              Retake Test
            </button>
            <button onClick={handleDownloadPdf} className="pdf">
              Download PDF
            </button>
          </div>
        </div>


      )}
    </div>
  );
};

export default SwotPage;
