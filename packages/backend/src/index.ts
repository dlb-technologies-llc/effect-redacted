const PORT = Number(process.env.PORT ?? 3001)

const server = Bun.serve({
  port: PORT,
  fetch(req) {
    const url = new URL(req.url)
    if (url.pathname === "/health") {
      return Response.json({ status: "ok", uptime: process.uptime() })
    }
    return new Response("Not Found", { status: 404 })
  },
})

console.log(`backend listening on http://localhost:${server.port}`)
