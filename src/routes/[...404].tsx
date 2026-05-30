export default function NotFound() {
  const styles = {
    page: {
      margin: "0 auto",
      display: "flex",
      "min-height": "100vh",
      "max-width": "48rem",
      "flex-direction": "column",
      "align-items": "center",
      "justify-content": "center",
      gap: "1rem",
      padding: "0 1.5rem",
      "text-align": "center",
      color: "#e5e5e5",
    },
    code: {
      "font-size": "0.75rem",
      "font-weight": 600,
      "letter-spacing": "0.35em",
      "text-transform": "uppercase",
      color: "#737373",
    },
    title: {
      margin: 0,
      "font-size": "3.75rem",
      "font-weight": 300,
      "letter-spacing": "0.18em",
      "text-transform": "uppercase",
      color: "#ffffff",
    },
    text: {
      "max-width": "36rem",
      "font-size": "1rem",
      color: "#a3a3a3",
    },
  } as const;

  return (
    <main style={styles.page}>
      <p style={styles.code}>404</p>
      <h1 style={styles.title}>Not Found</h1>
      <p style={styles.text}>
        This route does not exist in the current ChatYX SPA.
      </p>
    </main>
  );
}
