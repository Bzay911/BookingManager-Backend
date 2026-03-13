export const serviceController = {
    async getServices(req,res){
        try{
            const {businessId} = req.params;
            const services = await prisma.service.findMany({
                where: { businessId: parseInt(businessId) },
                include: { business: true }
            });
            console.log("Fetched services for businessId:", businessId, "Services:", services);
            res.status(200).json(services);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }
};