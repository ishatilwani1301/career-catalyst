# Career Catalyst: Your Lifelong Learning Coach

**AI For India: Empowering Minds, Enabling Futures**

Career Catalyst is a cutting-edge, AI-powered personal career coach designed specifically for Indian professionals. Whether you are a fresh graduate (New Entrant), looking to switch industries (Career Changer), or returning to the workforce after a break (Career Returner), Career Catalyst creates a hyper-personalized pathway to help you achieve your aspirations.

## 🚀 Key Features

*   **Personalized Skill Roadmaps**: Generates step-by-step learning paths tailored to your current profile and target career using advanced AI.
*   **Resume Autofill**: Upload your PDF resume to automatically populate your professional profile instantly.
*   **Multilingual Support**: Fully localized in **English, Hindi, Tamil, Telugu, Kannada, Bengali, and Malayalam** to support diverse users across India.
*   **AI Interview Coach**:
    *   **Text & Audio Mock Interviews**: Practice behavioral and technical interviews with a real-time AI coach powered by the Multimodal Live API.
    *   **Live Feedback**: Receive instant, constructive feedback on your answers, including clarity, impact, and technical correctness.
    *   **Elevator Pitch Refinement**: Hone your introduction with specific scoring and actionable suggestions.
*   **Visual Jamboard**: Break down complex concepts into simple, illustrated steps using AI-generated explanations and visuals.
*   **Daily Bytes**: Stay updated with curated, relevant industry news and developments specific to your target role.
*   **Technical Challenges**: Solve coding and case-study challenges generated on the fly based on specific job descriptions.

## 🛠️ Technologies Used

*   **Frontend**: React (v19), Tailwind CSS for responsive and accessible UI.
*   **AI Models**:
    *   **Gemini 2.5 Flash**: For fast, reasoning-based content generation (Roadmaps, News, Interview logic).
    *   **Gemini 2.5 Flash Native Audio**: For real-time, low-latency audio interview simulations.
    *   **Imagen 3**: For generating educational visuals in the Jamboard.
*   **Speech Services**: Web Speech API for text-to-speech synthesis and native browser audio handling.
*   **PDF Processing**: pdf.js for client-side resume parsing.

## 🏁 Getting Started

### Prerequisites

*   Node.js (v18 or higher recommended)
*   npm or yarn

### Installation

1.  Clone the repository:
    ```bash
    git clone https://github.com/ishatilwani1301/career-catalyst.git
    cd career-catalyst
    ```

2.  Install dependencies:
    ```bash
    npm install
    ```

### Configuration

1.  Create a `.env` file in the root directory.
2.  Add your Gemini API key:
    ```env
    API_KEY=your_gemini_api_key_here
    ```

### Running the App

Start the development server:
```bash
npm start
```
Open [http://localhost:3000](http://localhost:3000) to view it in the browser.



---
*Empowering India's workforce, one skill at a time.*