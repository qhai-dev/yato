export default async function Page({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params

    return <div className="h-full w-full overflow-hidden">{id} conversation page component</div>
}
